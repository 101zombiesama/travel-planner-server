const router = require('express').Router();
const fetch = require('node-fetch');
const osmtogeojson = require('osmtogeojson');
const cheerio = require('cheerio');
const Detail = require('../models/Detail');
const Place = require('../models/Place');

const { majorKeys } = require('../supplements/majorKeys');


// ***PRIVATE METHODS***
const getWikidata = async (wikidataId) => {
    // returns an object with wiki urls.
    const response = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${wikidataId}.json`);
    const result = await response.json();
    var subtitle = null;
    var wikipedia = null;
    var wikivoyage = null;
    var wikimedia = null;
    if (result.entities[wikidataId].descriptions.en) subtitle = result.entities[wikidataId].descriptions.en.value;
    if (result.entities[wikidataId].sitelinks.enwiki) wikipedia = result.entities[wikidataId].sitelinks.enwiki.url;
    if (result.entities[wikidataId].sitelinks.enwikivoyage) wikivoyage = result.entities[wikidataId].sitelinks.enwikivoyage.url;
    if (result.entities[wikidataId].sitelinks.commonswiki) wikimedia = result.entities[wikidataId].sitelinks.commonswiki.url;
    const obj = {
        subtitle,
        wikipedia,
        wikivoyage,
        wikimedia,
    }
    return obj;
}

const getWikiExtract = async (url, source) => {
    const response = await fetch(url);
    const result = await response.text();
    const $ = cheerio.load(result);
    const container = $('#mw-content-text');
    const output = container.find('.mw-parser-output');
    const allPara = output.children('p').not('.mw-empty-elt');
    const firstPara = allPara.eq(0).text()
    const secondPara = allPara.eq(1).text();
    if (source === 'wikipedia') return firstPara;
    if (source === 'wikivoyage') return secondPara;
    
}
const getWikiImages = async (url) => {
    // url needs to be the commons.wikimedia url
    const getImageLink = async (url) => {
        const response = await fetch(url);
        const result = await response.text();
        const $ = cheerio.load(result);
        const file = $('#file');
        const src = file.find('img').attr('src');
        return src;
    }

    const response = await fetch(url);
    const result = await response.text();
    const $ = cheerio.load(result);
    const gallery = $('ul.gallery');
    const i_pages = [];
    gallery.find('a.image').each((i, a) => {
        i_pages.push(a.attribs.href);
    });
    // limit the number of images to 20
    if (i_pages.length > 20) {
        i_pages.splice(20);
    }

    // iterating over image pages and get img src of images
    const src = [];
    for (let link of i_pages) {
        const url = `https://commons.wikimedia.org${link}`;
        const image = await getImageLink(url);
        src.push(image);
    }

    return src;
    
}

const getFlickrImageURL = async (id, size) => {
    const response = await fetch(`https://www.flickr.com/services/rest/?method=flickr.photos.getSizes&api_key=${process.env.FLICKR_API_KEY}&photo_id=${id}&format=json&nojsoncallback=1`);
    const result = await response.json();
    const sizes = result.sizes.size;
    const objs = sizes.filter(obj => { return obj.label == size });
    if (objs.length <=0) return null;
    const url = objs[0].source;
    return url;
}

const getFlickrImagesForText = async (text, center) => {
    const images = [];
    const response = await fetch(`https://www.flickr.com/services/rest/?method=flickr.photos.search&api_key=${process.env.FLICKR_API_KEY}&text=${encodeURIComponent(text)}&has_geo=1&sort=relevance&lat=${center[1]}&lon=${center[0]}&radius=1&per_page=10&format=json&nojsoncallback=1`);
    const result = await response.json();
    const photos = result.photos.photo;
    const photoIds =  photos.map(photo => photo.id);
    for (let id of photoIds) {
        const image = await getFlickrImageURL(id, 'Medium');
        if (image) {
            images.push(image);
        }
    }
    return images;
}

// ***ROUTES***

router.get('/osmdata', async (req, res, next) => {
    const body = req.query.data
    const response = await fetch(`https://overpass.kumi.systems/api/interpreter?data=${body}`);
    const result = await response.json();
    const geojson = osmtogeojson(result);
    res.send(geojson);
});

router.get('/details/osm', async (req, res, next) => {
    var { source_id, detail_id } = req.query;

    if(detail_id === 'null') detail_id = null;

    // check if data is available in db
    const detail = await Detail.findOne({ source_id: source_id });
    if (detail) {
        res.send(detail);
        console.log('details found from the db!')
        return;
    }

    // if detail is not available in the db, fetch it from the detailID using appropriate web api and save to db.
    // Also save the place to db if not already

    // source_id = detail_id
    // get the osm data

    const id = source_id.split('/')[1];
    const data = `[out:json];node(${id});out;`;
    const response = await fetch(`https://overpass.kumi.systems/api/interpreter?data=${data}`);
    const result = await response.json();
    const tags = result.elements[0].tags;

    // get the type property by checking against the stored majorKeys.
    const tagKeys = Object.keys(tags);
    const place_type_arr = []
    for (let majorKey of majorKeys) {
        if(tagKeys.includes(majorKey)) {
            place_type_arr.push(`${majorKey}:${tags[majorKey]}`);
        }
    }

    // get the description and images
    var wikisubtitle = null;
    var description = null;
    var images = [];
    if (tags.wikidata) {

        const { subtitle, wikipedia, wikivoyage, wikimedia } = await getWikidata(tags.wikidata);
        if(subtitle) {
            wikisubtitle = subtitle;
        }
        if(wikivoyage) {
            const voyageDescription = await getWikiExtract(wikivoyage, 'wikivoyage');
            description = voyageDescription;
        }
        else if (wikipedia) {
            const wikipediaDescription = await getWikiExtract(wikipedia, 'wikipedia');
            description = wikipediaDescription;
        }
        if (wikimedia) {
            // *** GETTING IMAGES!! ***
            // const wikimediaImages = await getWikiImages(wikimedia);
            // images = wikimediaImages;
        }


    }
    // if wikipedia page is available but no wikidata!
    if ( description == null && tags.wikipedia) {
        const wikipediaDescription = await getWikiExtract(`https://www.wikipedia.org/wiki/${encodeURIComponent(tags.wikipedia)}`, 'wikipedia');
        description = wikipediaDescription;
    }
    
    // defining other properties
    var name = null;
    var name_en = null;
    var address = null;
    var opening_hours = null;
    var charge = null;
    var phone = null;
    var email = null;
    var website = null;

    if(tags.name) name = tags.name;
    if (tags['name:en']) name_en = tags['name:en'];
    if (tags['addr:full']) address = tags['addr:full'];
    if (tags.opening_hours) opening_hours = tags.opening_hours;
    if(tags.charge) charge = tags.charge;
    if (tags.phone) phone = tags.phone;
    if (tags.email) email = tags.email;
    if (tags.website) website = tags.website;
    

    // check if place
    var place = await Place.findOne({ source_id: source_id });
    if (!place) {

        const newPlace = new Place({
            source_id,
            name,
            name_en,
            center: [ result.elements[0].lon, result.elements[0].lat ],
            category: null,
            type: place_type_arr
        });

        // *** SAVING THE PLACE OBJECT IN DATABASE!!  ***

        try {
            const savedPlace = await newPlace.save();
            console.log(`${savedPlace.name} place saved in db!`)
            place = savedPlace;
        } catch (error) {
            console.log(error);
            next(error);
        }

    }
    
    const newDetail = new Detail({
        idPlace: place.id,
        source: 'osm',
        source_id,
        center: [ result.elements[0].lon, result.elements[0].lat ],
        name: tags.name,
        name_en,
        subtitle: wikisubtitle,
        address,
        description,
        type: place_type_arr,
        category: null,
        opening_hours,
        charge,
        phone,
        email,
        website,
        images,
        rating: null,
        osm_tags: tags
    });

    // *** SAVING THE DETAIL OBJECT IN DATABASE!! Saving details or each place will take a lot of storage data!!! ***

    newDetail.save((err, newDetail) => {
        if (err) next(err);
        console.log(`${newDetail.name} newDetail has been saved!!`);

        res.send(newDetail);

    });
        
     
});

router.get('/details/mapbox', async (req, res, next) => {
    var { source_id, detail_id, convertedPlace } = req.query;

    if(detail_id === 'null') detail_id = null;

    const parsedPlace = JSON.parse(convertedPlace);

    // check if data is available in db
    const detail = await Detail.findOne({ source_id: source_id });
    if (detail) {
        res.send(detail);
        console.log('details found from the db!')
        return;
    }

    // if detail is not available in the db, fetch it from the detailID using appropriate web api and save to db.
    // Also save the place to db if not already

    // get the description and images
    var wikisubtitle = null;
    var description = null;
    var images = [];
    if (detail_id) {

        const { subtitle, wikipedia, wikivoyage, wikimedia } = await getWikidata(detail_id);
        if(subtitle) {
            wikisubtitle = subtitle;
        }
        if(wikivoyage) {
            const voyageDescription = await getWikiExtract(wikivoyage, 'wikivoyage');
            description = voyageDescription;
        }
        else if (wikipedia) {
            const wikipediaDescription = await getWikiExtract(wikipedia, 'wikipedia');
            description = wikipediaDescription;
        }
        if (wikimedia) {
            // *** GETTING IMAGES!! ***
            // const wikimediaImages = await getWikiImages(wikimedia);
            // images = wikimediaImages;
        }


    }
    

    // check if place
    var place = await Place.findOne({ source_id: source_id });
    if (!place) {

        const newPlace = new Place({
            source_id,
            name: parsedPlace.name,
            name_en: null,
            center: parsedPlace.center,
            category: null,
            type: []
        });

        // *** SAVING THE PLACE OBJECT IN DATABASE!!  ***

        try {
            const savedPlace = await newPlace.save();
            console.log(`${savedPlace.name} place saved in db!`)
            place = savedPlace;
        } catch (error) {
            console.log(error);
            next(error);
        }

    }
    
    const newDetail = new Detail({
        idPlace: place.id,
        source: 'mapbox',
        source_id,
        center: place.center,
        name: place.name,
        name_en: null,
        subtitle: wikisubtitle,
        address: null,
        description,
        type: place.type,
        category: null,
        opening_hours: null,
        charge: null,
        phone: null,
        email: null,
        website: null,
        images: [],
        rating: null,
        osm_tags: null
    });

    // *** SAVING THE DETAIL OBJECT IN DATABASE!! Saving details or each place will take a lot of storage data!!! ***

    newDetail.save((err, newDetail) => {
        if (err) next(err);
        console.log(`${newDetail.name} newDetail has been saved!!`);

        res.send(newDetail);

    });
        
     
});

router.get('/images', async (req, res, next) => {
    const { detail_id } = req.query;

    // find the detail with detail_id
    const detail = await Detail.findById(detail_id);

    if(!detail) {
        res.send([]);
        console.log("could not find details obj in db! for images");
        return;
    };

    if(detail.images.length > 0) {
        res.send(detail.images);
        console.log('images found in DB!!!')
    } else {
        const images = await getFlickrImagesForText(detail.name, detail.center);
        res.send(images);

        // save the fetched images in db
        const detailImages = detail.images;
        detail.images = [...detailImages, ...images];
        detail.save((err, detail) => {
            if (err) next(err);
        });
    }

});


module.exports = router;