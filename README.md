1. Two ways to sign up
    a. Sign up using google
    b. sign up using email password and username form
2. Two ways to log in
    a. Log in using google
    b. Log in using email password

routes to be made:
    1. GET /auth/google

        this route logs in the user or creates account if the user doesnt exist.

        after successful result from google api, a unique username is created for the user as `${email(before@)}_randomString`.
        Username can be changed later on.
        Password field for this google auth signup will be empty and can be set later on. So the user can log in with google or even with local strategy even if he signed up with google.
        "emailVerified" field will be set to true for this auth. and "emailVerificationTOken" will be null.

    2. POST /auth/signup

        local strategy signup.
        user will fill the form with email, username and password. (username should not contain '@' char)

        if email already exists in database, respond with:
            Account already exists with this email (try loggin in with email and password or with google)
 
        after hashing the password, and creating the account, a flag called "emailVerified" will be set to "false" by default.
        a secret token will be generated and will be saved in "emailVerificationToken".
        An hyperlink with this token will be generated and sent to the user email for verification

    3. GET /auth/verify/{secretToekn}

        Route used to verify the email. for this route, server will extract the token from the req url and check against the database if
        the user exists with "emailVerficationToken" = {secretToken}.
        If user exists, modify the user as:
            "emailVerificationToken" = ""  (empty string indicating that the email is already verified)
            "emailVerified" = True
            send response as verification successful

        if no user matches with the secret token, then:
            token is invalid or already verified

    4. POST /auth/signin

        local strategy for sign in.
        User will fill the form with email/username and password.
        check if the email password combo or username password combo exists.

        If user exists, then done(null, user) and redirect to dashboard and send relevent information for user as JSON response.

        If user doesnt exist, then respond with:
            Account doesnt exist.




