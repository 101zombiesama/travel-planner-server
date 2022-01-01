const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Schema = mongoose.Schema;

const userSchema = new Schema({
    email: { type: String, required: true },
    username: { type: String, required: true },
    role: { type: String, enum: ['USER', 'ADMIN'], required: true },
    name: String,
    password: String,
    emailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, default: "" },
    profilePicture: String
}, { timestamps: true });

userSchema.methods.hashPassword = (password) => {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(10))
};

userSchema.methods.comparePassword = (password, hash) => {
    return bcrypt.compareSync(password, hash);
};

const User = mongoose.model('user', userSchema);

module.exports = User;