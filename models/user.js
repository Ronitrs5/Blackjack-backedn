const { default: mongoose } = require("mongoose");

const user = mongoose.Schema(
    {
        username:{
            type: String, 
            required: true,
        },

        balance:{
            type: Number,
            required: true,
        }
    },

    {
        timestamps: true
    }
);

const USER = mongoose.model('user', user);

module.exports = USER;