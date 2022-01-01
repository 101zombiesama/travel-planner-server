const sgMail = require('@sendgrid/mail');
const mailjet = require ('node-mailjet')
.connect(process.env.MAILJET_API_KEY, process.env.MAILJET_API_SECRET);

class Monitor {
    count=0;
    details = {};
    constructor() {

    }

    get count() {
        return this.count
    }
    set count(value) {
        this.count = value;
    }

    check(url) {

        const u = new URL(url);
        if (u.hostname == 'maps.googleapis.com') {

            const split = url.split('https://maps.googleapis.com/maps/api/');
            const split2 = split[1];
            var name2 = split2.split('/')[1];
            name2 = name2.split('?')[0];
            const name = `${split2.split('/')[0]}/${name2}`
            if (this.details[name]) {
                this.details[name] += 1;
            } else {
                this.details[name] = 1;
            }

            this.count += 1;
        }
    }

    reset() {
        this.count = 0;
        this.details = {};
    }

    calculatePricing() {
        const price = {total: 0};
        for (const [key, val] of Object.entries(this.details)) {
            var rate;
            if (key == 'geocode/json') rate = 5/1000;
            if (key == 'place/details') rate = 17/1000;
            if (key == 'place/nearbysearch') rate = NaN;
            if (key == 'place/photo') rate = 7/1000;

            price[key] = rate*(this.details[key]);
            price.total += rate*(this.details[key]);
        }
        return price;
    }

    startMonitor() {
        this.reset();
    }

    stopMonitor() {
        const finalCount = this.count;
        const finalPricing = this.calculatePricing();
        const finalDetails = this.details;
        // reset Monitor
        this.reset();

        return { count: finalCount, details: finalDetails, pricing: finalPricing };
    }
}

const monitor = new Monitor();

const sendVerificationMail = async (to, token, req, res) => {

    const request = mailjet
        .post("send", {
            'version': 'v3.1'
        })
        .request({
            "Messages": [{
                "From": {
                    "Email": "ajinkya.meshram@gmail.com",
                    "Name": "Travel Planner"
                },
                "To": [{
                    "Email": to,
                }],
                "Subject": "Travel-Planner account verification",
                "TextPart": "My first Mailjet email",
                "HTMLPart": `<body>
                                <h3> Please click the button below to verify your email <h3>
                                <br>
                                <hr>
                                <a href="http://localhost:5000/api/auth/signup/verify?t=${token}">VERIFY</a>
                            </body>`,
            }]
        })
    request
        .then((result) => {
            console.log(result.body)
        })
        .catch((err) => {
            console.log(err.statusCode)
        })

}

const checkSignedIn = (req, res, next) => {
    if(req.user) {
        next();
    } else {
        console.log("not logged in")
        res.status(401).send({ msg: "AUTH_CHECK_SIGNEDIN_FAIL" })
    }

}

const checkRole = (role) => {
    return (req, res, next) => {
        if(role != req.user.role) {
            res.status(401).send({ msg: "AUTH_CHECK_ROLE_UNAUTHORIZED" });
        } else {
            next();
        }
    }
}

module.exports = {
    sendVerificationMail,
    checkSignedIn,
    checkRole,
    monitor,
}
