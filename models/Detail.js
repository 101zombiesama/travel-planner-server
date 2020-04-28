const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const detailSchema = new Schema({
    idPlace: { type: String, ref: 'Place' },
    source: String, //'osm', 'mapbox'
    source_id: String, // 'node/1245787', 'poi.236842165'
    center: [{type:Number}],
    name: String,
    name_en: String,
    subtitle: String,
    address: String,
    description: String,
    type: [{ type: String }], //'amenity:bar',
    category: String, //'Natural', 'Urban', 'Metro', 'Mountain', 'Ocean/beaches', 'rural/countryside'
    opening_hours: String,
    charge: String, //price to access the place. e.g entrace fee, charge: '5EUR'
    phone: String,
    email: String,
    website: String,
    images: Array, //array of image urls
    rating: Number, //1-5
    osm_tags: Object //exact copy of osm properties object. raw data from osm.
}, { timestamps: true });

const Detail = mongoose.model('detail', detailSchema);

module.exports = Detail;