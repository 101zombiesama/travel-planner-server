const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
    email: { type: String, required: true },
    username: { type: String, required: true },
    name: String,
    password: String,
    emailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, default: "" },
    profilePicture: String
}, { timestamps: true });

const User = mongoose.model('user', userSchema);

module.exports = User;