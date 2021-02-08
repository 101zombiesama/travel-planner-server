const sgMail = require('@sendgrid/mail');
const mailjet = require ('node-mailjet')
.connect(process.env.MAILJET_API_KEY, process.env.MAILJET_API_SECRET);

const sendVerificationMail = async (to, token, req, res) => {
    // const msg = {
    //     to: to,
    //     from: 'verification@travelplanner.com',
    //     subject: 'Please verify your email',
    //     html: `<body>
    //             <h3> Please click the button below to verify your email <h3>
    //             <br>
    //             <hr>
    //             <a href="http://localhost:5000/api/auth/signup/verify?t=${token}">VERIFY</a>
    //         </body>`
    //   };
    
    // await sgMail.send(msg, (err, result) => {
    //     if(err) {
    //         console.log("there was an error sending mail", err.message);
    //         throw err;

    //     }
    //     else console.log(`mail sent to ${to}`);
    // });

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
    checkRole
}
