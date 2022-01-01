const router = require('express').Router();
const Trip = require('../models/Trip');
var mongoose = require('mongoose');
var { default: fetch } = require('node-fetch');
const { cluster, getDurationAtHubs, getHubPopularity, handleLackingClusters } = require('./tripgeneration');

const { monitor } = require('../helpers');

const ogFetch = fetch;
fetch = (url, opts) => {
    return new Promise((resolve, reject) => {
        
        ogFetch(url, opts).then(res => {

            monitor.check(url);

            resolve(res);
        }).catch(err => {
            reject(err);
        })
    })
}

const baseUrl = 'https://maps.googleapis.com/maps/api/place';

router.post('/create', async (req, res, next) => {
    const data = req.body;
    var { place_id } = req.query;
    const newTrip = new Trip(data);
    newTrip.userId = req.user._id;

    // adding placeId if provided
    if (place_id) {
        newTrip.placeIds.push(place_id);
        // getting image ref for this placeId and adding as cardPhotoId
        const response = await fetch(`${baseUrl}/details/json?place_id=${place_id}&fields=photo&key=${process.env.GOOGLE_API_KEY}`);
        const result = await response.json();
        if (result.result.photos.length !== 0) {
            const ref = result.result.photos[0].photo_reference;
            newTrip.cardPhotoRef = ref;
        }
    }

    newTrip.save((err, doc) => {
        if (err) {
            res.status(400).send({ msg: err.message });
        } else {
            res.status(201).send({ msg: "TRIPS_CREATE_SUCCESS", data: doc });
        }
    })

});

router.get('/getalltrips', async (req, res, next) => {
    const results = await Trip.find({ userId: req.user._id });
    res.status(200).send({ msg: "TRIPS_GETALLTRIPS_SUCCESS", data: results });
});

router.get('/gettrip', async (req, res, next) => {
    const { trip_id } = req.query;
    const trip = await Trip.findById(trip_id);

    if (!trip) {
        res.status(400).send({ msg: "TRIPS_GETTRIP_FAIL_INVALIDTRIPID" });
        return;
    }

    if (trip.userId != req.user._id) {
        res.status(400).send({ msg: "TRIPS_GETTRIP_FAIL_INVALIDUSER" });
        return;
    }

    res.status(200).send({ msg: "TRIPS_GETTRIP_SUCCESS", data: trip });
});

router.get('/delete', (req, res, next) => {
    const { trip_id } = req.query;

    Trip.findOneAndDelete({ _id: trip_id, userId: req.user._id }, (err, doc) => {
        if (err) {
            res.status(400).send({ msg: err.message });
        } else {
            res.status(200).send({ msg: "TRIPS_DELETE_SUCCESS", data: doc });
        }
    })

});

router.get('/addplace', async (req, res, next) => {
    var { place_id, trip_id } = req.query;

    // push the palceId in placeIds array of tripId object

    const trip = await Trip.findById(trip_id);

    if (!trip) {
        res.status(400).send({ msg: "TRIPS_UPDATE_FAIL_INVALIDTRIPID" });
        return;
    }
    if(trip.userId != req.user._id) {
        res.status(400).send({ msg: "TRIPS_UPDATE_FAIL_INVALIDUSER" });
        return;
    }
    
    // check if placeIds already contains placeId
    if (trip.placeIds.includes(place_id)) {
        res.status(200).send({ msg: "TRIPS_ADDPLACE_ALREADYEXISTS", data: trip });
    } else {

        // add cardPhotoRef if this is the first placeId to be added
        if (trip.placeIds.length == 0) {
            // getting image ref for this placeId and adding as cardPhotoId
            const response = await fetch(`${baseUrl}/details/json?place_id=${place_id}&fields=photo&key=${process.env.GOOGLE_API_KEY}`);
            const result = await response.json();
            if (result.result.photos.length !== 0) {
                const ref = result.result.photos[0].photo_reference;
                trip.cardPhotoRef = ref;
            }
        }

        trip.placeIds.push(place_id);
        const savedTrip = await trip.save();
        res.status(200).send({ msg: "TRIPS_ADDPLACE_SUCCESS", data: savedTrip });
    }

    
});

router.get('/removeplace', async (req, res, next) => {
    const { trip_id, place_id } = req.query;

    const trip = await Trip.findById(trip_id);

    if (!trip) {
        res.status(400).send({ msg: "TRIPS_UPDATE_FAIL_INVALIDTRIPID" });
        return;
    }
    if(trip.userId != req.user._id) {
        res.status(400).send({ msg: "TRIPS_UPDATE_FAIL_INVALIDUSER" });
        return;
    }

    const index = trip.placeIds.indexOf(place_id);

    if (index == -1) {
        res.status(200).send({ msg: "TRIPS_REMOVEPLACE_DOESNOTEXIST", data: trip });
    } else {

        // removing cardPhotoRef is this is the last placeId to be removed
        if (trip.placeIds.length == 1) {
            trip.cardPhotoRef = null;
        }

        trip.placeIds.splice(index, 1);
        const savedTrip = await trip.save();
        res.status(200).send({ msg: "TRIPS_REMOVEPLACE_SUCCESS", data: savedTrip });
    }

});

router.get('/changename', async (req, res, next) => {
    const { trip_id, name } = req.query;

    const trip = await Trip.findById(trip_id);

    if (!trip) {
        res.status(400).send({ msg: "TRIPS_UPDATE_FAIL_INVALIDTRIPID" });
        return;
    }
    if(trip.userId != req.user._id) {
        res.status(400).send({ msg: "TRIPS_UPDATE_FAIL_INVALIDUSER" });
        return;
    }

    trip.name = name;
    const savedTrip = await trip.save();

    res.status(200).send({ msg: "TRIPS_CHANGENAME_SUCCESS", data: savedTrip });

});

router.post('/changenotes', async (req, res, next) => {
    const { trip_id } = req.query;
    const { notes } = req.body;
    const trip = await Trip.findById(trip_id);

    if (!trip) {
        res.status(400).send({ msg: "TRIPS_UPDATE_FAIL_INVALIDTRIPID" });
        return;
    }
    if(trip.userId != req.user._id) {
        res.status(400).send({ msg: "TRIPS_UPDATE_FAIL_INVALIDUSER" });
        return;
    }

    trip.notes = notes;
    const savedTrip = await trip.save();

    res.status(200).send({ msg: "TRIPS_CHANGENOTES_SUCCESS", data: savedTrip });

});

router.get('/changedates', async (req, res, next) => {
    const { startDate, endDate, trip_id } = req.query;

    const trip = await Trip.findById(trip_id);

    if (!trip) {
        res.status(400).send({ msg: "TRIPS_UPDATE_FAIL_INVALIDTRIPID" });
        return;
    }
    if(trip.userId != req.user._id) {
        res.status(400).send({ msg: "TRIPS_UPDATE_FAIL_INVALIDUSER" });
        return;
    }

    if (startDate) {
        trip.startDate = startDate;
    }
    if (endDate) {
        trip.endDate = endDate;
    }

    try {
        const savedTrip = await trip.save();
        res.status(200).send({ msg: "TRIPS_CHANGEDATES_SUCCESS", data: savedTrip });
    } catch (error) {
        res.status(200).send({ msg: "TRIPS_CHANGEDATES_FAIL_VALIDITYERROR"});
    }
    

});

router.get('/changebudget', async (req, res, next) => {
    const { trip_id, budgetAmount, budgetCurrency } = req.query;

    const trip = await Trip.findById(trip_id);

    if (!trip) {
        res.status(400).send({ msg: "TRIPS_UPDATE_FAIL_INVALIDTRIPID" });
        return;
    }
    if(trip.userId != req.user._id) {
        res.status(400).send({ msg: "TRIPS_UPDATE_FAIL_INVALIDUSER" });
        return;
    }

    if (budgetAmount) {

        trip.budgetAmount = Number(budgetAmount);
    }
    if (budgetCurrency) {
        trip.budgetCurrency = budgetCurrency;
    }

    try {
        const savedTrip = await trip.save();
        res.status(200).send({ msg: "TRIPS_CHANGEBUDGET_SUCCESS", data: savedTrip });
    } catch (error) {
        res.status(200).send({ msg: "TRIPS_CHANGEBUDGET_FAIL_VALIDITYERROR"});
    }
    
});

// generating plan
router.post('/generateplan', async (req, res, next) => {
    console.log("generating plan...");
    const { places } = req.body;
    const clust = cluster(places, 8000);
    const popularity = await getHubPopularity(clust, places);
    const update = await handleLackingClusters(popularity, places, 10, 60);
    if (update) {
        res.status(200).send({ msg: "TRIPS_GENERATEPLAN_SUCCESS", data: clust });
    }
})

module.exports = router;