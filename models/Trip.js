const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const tripSchema = new Schema({

    userId: {type: String, ref: 'User'},
    name: {type: String, required: true},
    notes: {type: String},
    startDate: {type: Date, required: true},
    endDate: {type: Date, required: true},
    budgetAmount: {type: Number, required: true},
    budgetCurrency: {type: String, required: true},
    placeIds: [{ type: String }],
    planGenerated: {type: Boolean, default: false},
    cardPhotoRef: String,

}, { timestamps: true });

const Trip = mongoose.model('trip', tripSchema);

module.exports = Trip;