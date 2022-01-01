const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const placeSchema = new Schema({
    source_id: String, // 'node/1354894' or 'poi.22321894153'
    name: String,
    name_en: String,
    center: [{ type: Number }],
    category: String,
    type: [{ type: String }],
}, { timestamps: true });

const Place = mongoose.model('place', placeSchema);

module.exports = Place;