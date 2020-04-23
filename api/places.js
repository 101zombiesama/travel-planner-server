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
    const firstPara = output.find('p').not('.mw-empty-elt').first('p');
    const secondPara = firstPara.next('p');
    if (source === 'wikipedia') return firstPara.text();
    if (source === 'wikivoyage') return secondPara.text();
    
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

// ***ROUTES***

router.get('/osmdata', async (req, res, next) => {
    const body = req.query.data
    const response = await fetch(`https://overpass.kumi.systems/api/interpreter?data=${body}`);
    const result = await response.json();
    const geojson = osmtogeojson(result);
    res.send(geojson);
});

router.get('/details', async (req, res, next) => {
    const { source, source_id, detail_id } = req.query;

    // check if data is available in db
    const detail = await Detail.findOne({ source_id: source_id });
    if (detail) {
        res.send(detail);
        console.log('details found from the db!')
        return;
    }

    // if detail is not available in the db, fetch it from the detailID using appropriate web api and save to db.
    // Also save the place to db if not already
    if (source === 'osm') {
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
        if (description == null && tags.wikipedia != null) {
            const wikipediaDescription = await getWikiExtract(`https://www.wikipedia.org/wiki/${tags.wikipedia}`, 'wikipedia');
            description = wikipediaDescription;
        }
        
        // defining other properties
        var name_en = null;
        var address = null;
        var opening_hours = null;
        var charge = null;
        var phone = null;
        var email = null;
        var website = null;

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
                name: tags.name,
                name_en,
                center: [ result.elements[0].lon, result.elements[0].lat ],
                category: null,
                type: place_type_arr
            });

            // *** SAVING THE PLACE OBJECT IN DATABASE!! ***

            // newPlace.save((err, place) => {
            //     if(err) next(err);
            //     console.log(`${place.name} place has been saved!!`)
            // });

            place = newPlace;
        }
        
        const detail = new Detail({
            idPlace: place.id,
            source: 'osm',
            source_id,
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

        // *** SAVING THE DETAIL OBJECT IN DATABASE!! ***

        // detail.save((err, detail) => {
        //     if (err) next(err);
        //     console.log(`${detail.name} detail has been saved!!`)
        // });

        res.send(detail);
        

    }
    if (source === 'mapbox') {
        // detail_id = wikidataID

    }
    // const images = await getWikiImages('https://commons.wikimedia.org/wiki/Category:National_Art_Center,_Tokyo');
    // res.send(images);
     
});

module.exports = router;