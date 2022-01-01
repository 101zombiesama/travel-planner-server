const router = require('express').Router();
var fetch = require('node-fetch');
const cheerio = require('cheerio');

const { monitor } = require('../helpers');

const ogFetch = fetch;
fetch = (url, opts) => {
    return new Promise((resolve, reject) => {
        
        ogFetch(url, opts).then(res => {

            monitor.check(url);

            resolve(res);
        }).catch(err => {
            reject(err);
        })
    })
}


const baseUrl = 'https://maps.googleapis.com/maps/api/place';

const getPlaceDescrition = async (name) => {
    name = encodeURI(name);
    const url = `https://www.google.com/search?q=${name}`;
    const response = await fetch(url);
    const result = await response.text()

    const $ = cheerio.load(result);
    // var description = $('h3').filter(function() {
    //     return $(this).text().indexOf('Description') > -1;
    // }).next().text();

    const mainContainer = $('#main');
    const div2 = mainContainer.children('div:nth-child(4)').text();

    

    return div2;
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

router.get('/thingstodo', async (req, res, next) => {
    // returns things to do or tourist attractions in a locality if its a locality of in 20km radius if its a sublocality
    var {lat, lon, name, method} = req.query;
    var url;
    // name = encodeURI(name);
    const term = encodeURI(`${name},${name} things to do`);
    if (method == 'textsearch') {
        url = `${baseUrl}/textsearch/json?query=${term}&language=en&key=${process.env.GOOGLE_API_KEY}`;
    }
    else {
        url = `${baseUrl}/textsearch/json?query=${term}&language=en&key=${process.env.GOOGLE_API_KEY}`;
        // url = `${baseUrl}/nearbysearch/json?location=${lat},${lon}&radius=20000&type=point_of_interest&rankby=prominence&key=${process.env.GOOGLE_API_KEY}`;
    }
    
    const response = await fetch(url);
    const result = await response.json();
    result.results.sort((a, b) => {
        return b.user_ratings_total - a.user_ratings_total
    })
    res.send(result);
});

router.get('/autocomplete', async (req, res, next) => {
    const {input, sessiontoken} = req.query;
    const response = await fetch(`${baseUrl}/autocomplete/json?input=${input}&key=${process.env.GOOGLE_API_KEY}&sessiontoken=${sessiontoken}
    `);

    const result = await response.json();
    res.send(result);
});

router.get('/details', async (req, res, next) => {
    const {place_id, sessiontoken} = req.query;
    var url = `${baseUrl}/details/json?place_id=${place_id}&key=${process.env.GOOGLE_API_KEY}`;
    if (sessiontoken) {
        url = `${baseUrl}/details/json?place_id=${place_id}&sessiontoken=${sessiontoken}&key=${process.env.GOOGLE_API_KEY}`;
    }
    const response = await fetch(url);
    const result = await response.json();
    res.send(result);
});

router.get('/search', async (req, res, next) => {
    const {input, fields} = req.query;
    var url = `${baseUrl}/findplacefromtext/json?input=${input}&inputtype=textquery&key=${process.env.GOOGLE_API_KEY}`;
    if (fields) {
        url = `${baseUrl}/findplacefromtext/json?input=${input}&inputtype=textquery&fields=${fields}&key=${process.env.GOOGLE_API_KEY}`;
    }
    const response = await fetch(url);
    const result = await response.json();
    res.send(result);
});

// takes one photo ref and returns the photo url
router.get('/image', async(req, res, next) => {
    const {ref} = req.query;
    var url = `${baseUrl}/photo?maxwidth=1000&photoreference=${ref}&key=${process.env.GOOGLE_API_KEY}`
    const response = await fetch(url);
    if (response.status == 200) {
        res.status(response.status).send(response.url);
    }
    else {
        res.status(response.status).send({});
    }
});

// takes place_id and returns all photo urls
router.post('/images', async(req, res, next) => {
    const refs = req.body.refs;
    var imgUrls = [];
    // get img url for each photo ref
    for (let ref of refs) {
        var url = `${baseUrl}/photo?maxwidth=1000&photoreference=${ref}&key=${process.env.GOOGLE_API_KEY}`;
        const response = await fetch(url);
        imgUrls.push(response.url);
    }

    res.send({ imgUrls });
});

router.get('/flickrimages', async (req, res, next) => {
    const { name, lat, lon } = req.query;

    const images = await getFlickrImagesForText(name, [lon, lat]);
    res.send(images);

});

router.get('/description', async (req, res, next) => {
    const { name } = req.query;

    const description = await getPlaceDescrition(name);
    res.send(description);

});


module.exports = router;