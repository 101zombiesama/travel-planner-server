const sgMail = require('@sendgrid/mail');

const sendVerificationMail = (to, token) => {
    const msg = {
        to: to,
        from: 'verification@travelplanner.com',
        subject: 'Please verify your email',
        html: `<body>
                <h3> Please click the button below to verify your email <h3>
                <br>
                <hr>
                <a href="http://localhost:5000/auth/signup/verify?t=${token}">VERIFY</a>
            </body>`
      };
    
    sgMail.send(msg, (err, result) => {
        if(err) console.log("there was an error sending mail", err);
        else console.log(`mail sent to ${to}`);
    });
}

module.exports = { sendVerificationMail }
