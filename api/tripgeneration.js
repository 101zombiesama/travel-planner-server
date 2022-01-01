const skmeans = require("skmeans");
var { default: fetch } = require('node-fetch');

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

const secondaryPlaceTypes = {

    // Primary
    establishment: [1.5, 2],
    food: [0.5, 1],
    natural_feature: [1, 2],
    place_of_worship: [1, 2],

    // Secondary
    airport: [3, 0],
    amusement_park: [4, 6],
    aquarium: [1, 2],
    art_gallery: [1, 2],
    bar: [0.5, 1],
    beauty_salon: [0.5, 1],
    bowling_alley: [1, 2],
    cafe: [0.5, 1],
    casino: [1, 2],
    cemetery: [0.5, 1],
    church: [0.5, 1],

    library: [1, 2],
    movie_theater: [3, 3],
    museum: [1, 2],
    night_club: [1, 2],
    park: [2, 3],
    restaurant: [1, 2],
    shopping_mall: [1, 2],
    spa: [0.5, 1.5],
    supermarket: [0.5, 1],
    tourist_attraction: [2, 0],
    train_station: [0.5, 1],
    university: [1, 2],
    zoo: [1.5, 2.5]
}



const getDurations = (places) => {
    const durations = [];
    for (let place of places) {
        var duration = [0, 0];
        for (let tag of place.types) {
            if (secondaryPlaceTypes[tag] != undefined) {
                
                if (secondaryPlaceTypes[tag][0] > duration[0]) duration[0] = secondaryPlaceTypes[tag][0];
                if (secondaryPlaceTypes[tag][1] > duration[1]) duration[1] = secondaryPlaceTypes[tag][1];
            }
            else {
                
                if (duration[0] < 2) duration[0] = 2;
                if (duration[1] < 2) duration[1] = 2;
            }
        }
        durations.push(duration);
    }
    return durations;
}

function getAllIndexes(arr, val) {
    var indexes = [], i;
    for(i = 0; i < arr.length; i++)
        if (arr[i] === val)
            indexes.push(i);
    return indexes;
}

const getCentroid = (places) => {
    // Returns centroid of places in [lat, lng] format array

    // convert each lat lng into radians
    const radians = [];
    for (let p of places) {
        const lat = p.geometry.location.lat * (Math.PI/180);
        const lng = p.geometry.location.lng * (Math.PI/180);
        radians.push([lat, lng]);
    }

    // convert each location to cartesian coordinate
    const cartesians = []; //[X, Y, Z]
    for (let loc of radians) {
        const x = Math.cos(loc[0]) * Math.cos(loc[1]);
        const y = Math.cos(loc[0]) * Math.sin(loc[1]);
        const z = Math.sin(loc[0]);

        cartesians.push([x, y, z]);
    }

    //  calculate mean of cartesian coordinates
    const sumX = 0;
    const sumY = 0;
    const sumZ = 0;
    for (let c of cartesians) {
        sumX += c[0];
        sumY += c[1];
        sumZ += c[2];
    }

    const cartesianCentroid = [sumX/cartesians.length, sumY/cartesians.length, sumZ/cartesians.length];

    // Converting cartesian centroid to lat lon centroid location
    const centroidLon = Math.atan2(cartesianCentroid[1], cartesianCentroid[0]);
    const hyp = Math.sqrt((cartesianCentroid[0]**2) + (cartesianCentroid[1]**2));
    const centroidLat = Math.atan2(cartesianCentroid[2], hyp);

    return [centroidLat, centroidLon];

}

const cartesianToGeo = (c) => {
    const lng = Math.atan2(c[1], c[0]);
    const hyp = Math.sqrt((c[0]**2) + (c[1]**2));
    const lat = Math.atan2(c[2], hyp);

    return [lat, lng];
}

const getGeoDistance = (c1, c2) => {
    // Returns distance in meters
    // c1 and c2 are arrays of lat lng, [lat, lng]

    const lat1 = c1[0];
    const lat2 = c2[0];
    const lon1 = c1[1];
    const lon2 = c2[1];

    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180; // φ, λ in radians
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    const d = R * c; // in metres

    return d;

}

const getCartesianDistance = (c1, c2) => {

    var a = c2[0] - c1[0];
    var b = c2[1] - c1[1]; 
    var c = c2[2] - c1[2];

    var distance = Math.sqrt(a * a + b * b + c * c);

    return distance;
}

const createClusters = (places, k) => {
    // get array of 3d cartesian coordinates from places
    const geoCoords = [];
    const radians = [];
    for (let p of places) {
        const lat = p.geometry.location.lat * (Math.PI/180);
        const lng = p.geometry.location.lng * (Math.PI/180);
        radians.push([lat, lng]);
        geoCoords.push([p.geometry.location.lat, p.geometry.location.lng])
    }

    // convert each location to cartesian coordinate
    const cartesians = []; //[X, Y, Z]
    for (let loc of radians) {
        const x = Math.cos(loc[0]) * Math.cos(loc[1]);
        const y = Math.cos(loc[0]) * Math.sin(loc[1]);
        const z = Math.sin(loc[0]);

        cartesians.push([x, y, z]);
    }

    var res = skmeans(geoCoords, k, null, places.length**2, (c1, c2) => getGeoDistance(c1, c2));

    // add another correlation arrays for making ids for each centroid and relating places with the ids of their centroid
    
    return res;
}

const cluster = (places, d) => {
    // places array should be an array of place object appended with duration to visit

    var minKClust = { k: 10000 };
    const allClusters = [];
    
    loop0:
    for (let i=0; i<(places.length**2); i++) {

        var k = 1;
        loop1:
            while (true) {
                const clust = createClusters(places, k);
                // append variance
                var sumSqrdDist = 0;
                for (let [i, c] of clust.idxs.entries()) {
                    const dist = getGeoDistance(clust.centroids[c], [places[i].geometry.location.lat, places[i].geometry.location.lng]);
                    sumSqrdDist += dist**2;
                }

                const clusterVariance = sumSqrdDist/clust.k;

                clust.var = clusterVariance;

                // check condition
                for (let [i, c] of clust.centroids.entries()) {
                    // array of indices of places to check dist against
                    const indexes = getAllIndexes(clust.idxs, i);
            
                    for (let i of indexes) {
                        // find distance between place[i] and c
                        const dist = getGeoDistance(c, [places[i].geometry.location.lat, places[i].geometry.location.lng]);
                        if (dist > d) {
                            // skip to next iteration of while loop
                            k += 1;
                            continue loop1;
                        }
                        
                    }
            
                }

                
                // if (clust.k < minKClust.k) minKClust = clust;
                allClusters.push(clust);
                break loop1;
            }

    }

    // sort allClusters with increasing order of k
    allClusters.sort((a, b) => a.k - b.k);
    const minK = allClusters[0].k;
    const minKClusters = allClusters.filter(cl => cl.k == minK);
    // sort with increasing order of var
    minKClusters.sort((a, b) => a.var - b.var);

    minKClust = minKClusters[0];

    // add corrospondace array for places at each hub as [[placeId1, placeId2], [placeId3]]
    const hubPlacesMapping = [];
    for (let i=0; i<minKClust.k; i++) {
        hubPlacesMapping.push([]);
    }
    for (let [i, centroidIndex] of minKClust.idxs.entries()) {
        hubPlacesMapping[centroidIndex].push(places[i].place_id);
    }
    minKClust.hubPlacesMapping = hubPlacesMapping;
    minKClust.extraPlaces = [];
    delete minKClust.idxs;

    // append variances
    // var sumSqrdDist = 0;
    // for (let [i, h] of minKClust.hubPlacesMapping.entries()) {
    //     for (let p of h) {
    //         const place = places.filter(pl => pl.place_id == p)[0];
    //         const dist = getGeoDistance(minKClust.centroids[i], [place.geometry.location.lat, place.geometry.location.lng]);
    //         sumSqrdDist += dist**2;
    //     }
    // }

    // const clusterVariance = sumSqrdDist/minKClust.k;

    // minKClust.var = clusterVariance;

    getDurationAtHubs(minKClust, places);

    return minKClust;

}

// calculating time to be spent (number of days and nights) at each hub(centroud hotel)
const getDurationAtHubs = (cluster, places) => {
    // returns the cluster with additional key "placeDurations[]" and "hubDurations[]" for each centroid
    // placeDurations = [[minTime, maxTime], []] corrosponding with places array
    // hubDurations = [[minTime, maxTime], []] corrosponding with centroids (hubs) array

    const placeDurations = getDurations(places);
    const hubDurations = [];

    for (let c of cluster.hubPlacesMapping) {
        var minSum = 0;
        var maxSum = 0;
        for (let p of c) {
            // get index of this place in the places array
            const placeIndex = places.findIndex(place => place.place_id == p);
            minSum += placeDurations[placeIndex][0];
            maxSum += placeDurations[placeIndex][1];

            
        }


        hubDurations.push([minSum, maxSum]);
    }
    
    cluster.placeDurations = placeDurations;
    cluster.hubDurations = hubDurations;

    return cluster;
}

const getHubPopularity = async (cluster, places) => {
    const M = 50000;
    const Q = -M/(Math.log(0.5));
    const hubPopularityIndexes = [];

    for (let [i, c] of cluster.hubPlacesMapping.entries()) {
        var scoreSum = 0;
        var total = 0;
        // for (let p of c) {
        //     var place = places.filter(pl => pl.place_id == p);
        //     place = place[0];

        //     // calculate score for this
        //     // discard the score as well as place if rating not available
        //     if (!place.rating) {
        //         continue;
        //     }
        //     const score = place.rating + 5*(1 - Math.exp(-place.user_ratings_total/Q));
        //     scoreSum += score;
        //     total += 1;
        // }

        // get locality of this centroid
        const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${cluster.centroids[i][0]},${cluster.centroids[i][1]}&key=${process.env.GOOGLE_API_KEY}`);
        const result = await response.json();

        var local = result.results[0].address_components.filter(comp => comp.types.includes("locality"));
        if (local.length == 0) {
            local = result.results[0].address_components.filter(comp => comp.types.includes("administrative_area_level_3"));
        }
        if (local.length == 0) {
            local = result.results[0].address_components.filter(comp => comp.types.includes("administrative_area_level_2"));
        }
        if (local.length == 0) {
            local = result.results[0].address_components.filter(comp => comp.types.includes("sublocality"));
        }
        if (local.length == 0) {
            hubPopularityIndexes.push(0);
            continue;
        }
        var locality = local[0].long_name;
        // console.log("locality: ", locality);
        var country = result.results[0].address_components.filter(comp => comp.types.includes("country"))[0].long_name;
        // get things to do for this locality
        const baseUrl = 'https://maps.googleapis.com/maps/api/place';
        const term = encodeURI(`${locality},${country} things to do`);
        const url = `${baseUrl}/textsearch/json?query=${term}&language=en&key=${process.env.GOOGLE_API_KEY}`;
        const response2 = await fetch(url);
        const result2 = await response2.json();
        result2.results.sort((a, b) => {
            return b.user_ratings_total - a.user_ratings_total
        });

        for (let p of result2.results) {

            // calculate score for this
            // discard the score as well as place if rating not available
            if (!p.rating) {
                continue;
            }
            // const score = p.rating + 5*(1 - Math.exp(-p.user_ratings_total/Q));
            const score = p.user_ratings_total;
            scoreSum += score;
            total += 1;
        }
        // console.log("score: ", scoreSum/total);
        hubPopularityIndexes.push(scoreSum/total);
    }

    // append to cluster
    cluster.hubPopularityIndexes = hubPopularityIndexes;
    return cluster;
}

const addPlacesToHub = async (c, hubDuration, placesInHub, maxActiveTime) => {
    // c is cooradinates of hub [lat, lng]
    // find locality of this centroid and run things to do api on this locality
    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${c[0]},${c[1]}&key=${process.env.GOOGLE_API_KEY}`);
    const result = await response.json();
    var local = result.results[0].address_components.filter(comp => comp.types.includes("locality"));
    if (local.length == 0) {
        local = result.results[0].address_components.filter(comp => comp.types.includes("administrative_area_level_3"));
    }
    if (local.length == 0) {
        local = result.results[0].address_components.filter(comp => comp.types.includes("administrative_area_level_2"));
    }
    if (local.length == 0) {
        local = result.results[0].address_components.filter(comp => comp.types.includes("sublocality"));
    }
    if (local.length == 0) {
        // cant find plcaes to add to this hub. Return null
        return null;
    }
    var locality = local[0].long_name;
    var country = result.results[0].address_components.filter(comp => comp.types.includes("country"))[0].long_name;
    // get things to do for this locality
    const baseUrl = 'https://maps.googleapis.com/maps/api/place';
    const term = encodeURI(`${locality},${country} things to do`);
    const url = `${baseUrl}/nearbysearch/json?location=${c[0]},${c[1]}&radius=20000&keyword=things%20to%20do&rankby=prominence&key=${process.env.GOOGLE_API_KEY}`;
    const response2 = await fetch(url);
    const result2 = await response2.json();
    result2.results.sort((a, b) => {
        return b.user_ratings_total - a.user_ratings_total
    });

    var totalHubDuration = hubDuration;
    var placesToBeAdded = [];
    for (let p of result2.results) {
        // check if adding this place will make non lacking cluster. If not then continue loop
        if (placesInHub.includes(p.place_id)) {
            continue;
        }

        // get placeDuration for this place
        const duration = getDurations([p])[0];
        if ((totalHubDuration[1] + duration[1]) > maxActiveTime) {
            // makes a non lacking cluster
            placesToBeAdded.push(p);
            totalHubDuration[0] += duration[0];
            totalHubDuration[1] += duration[1];
            break;
        }

        placesToBeAdded.push(p);
        totalHubDuration[0] += duration[0];
        totalHubDuration[1] += duration[1];

    }

    // return with an update object
    // recalculate centroid using mean of prev centroid and new places locations
    var sumLat = c[0];
    var sumLng = c[1];
    var placeIdsToBeAdded = [];
    for (let p of placesToBeAdded) {
        placeIdsToBeAdded.push(p.place_id);
        sumLat += p.geometry.location.lat;
        sumLng += p.geometry.location.lng;
    }

    const update = {
        centroid: [sumLat/(placesToBeAdded.length + 1), sumLng/(placesToBeAdded.length + 1)],
        places: [...placesInHub, ...placeIdsToBeAdded],
        hubDuration: totalHubDuration,
        extraPlaces: placesToBeAdded,
    }

    return update;
}

const isOneDayTripPossible = (c1, c2, v, maxActiveTime, hubDuration) => {
    // get distance between h1 and h2
    // v in kmph
    const dist = getGeoDistance(c1, c2);
    const time = dist/(v*1000); //time in hr
    const totalTripTime = (2*time) + hubDuration;
    if (time <= 3 && totalTripTime <= maxActiveTime) {
        return true;
    }
    return false;

}

const handleLackingClusters = async (cluster, places, maxActiveTime, v) => {
    // check for every centroid to fullfill maxActiveTime duration (maxActiveTime in Hr)
    // if hubDuration < maxActiveTime => (  )

    // rearrange hubs by their increasing order of popularity

    const centroids = [];
    const hubPlacesMapping = [];
    for (let i=0; i<cluster.centroids.length; i++) {
        centroids.push(JSON.stringify(cluster.centroids[i]));
        hubPlacesMapping.push(JSON.stringify(cluster.hubPlacesMapping[i]));
    }

    cluster.centroids.sort((a, b) => cluster.hubPopularityIndexes[centroids.indexOf(JSON.stringify(a))] - cluster.hubPopularityIndexes[centroids.indexOf(JSON.stringify(b))]);
    cluster.hubPlacesMapping.sort((a, b) => cluster.hubPopularityIndexes[hubPlacesMapping.indexOf(JSON.stringify(a))] - cluster.hubPopularityIndexes[hubPlacesMapping.indexOf(JSON.stringify(b))]);
    cluster.hubPopularityIndexes.sort((a, b) => a - b);

    getDurationAtHubs(cluster, places);

    // loop through hubs and check for lacking hubs
    const indexesToRemove = [];
    for (let [i, h] of cluster.hubPlacesMapping.entries()) {
        const hubDuraion = cluster.hubDurations[i][1];
        if (hubDuraion <= maxActiveTime) {

            // find closest hub
            var closestHubIndex=0;
            var minDist = 99999999999;
            for (let j=i+1; j<cluster.centroids.length; j++) {
                const dist = getGeoDistance(cluster.centroids[i], cluster.centroids[j])
                if (dist < minDist) {
                    minDist = dist;
                    closestHubIndex = j;
                }
            }

            // temporarily merge this hub with the closest hub and check if it forms non lacking hub
            var isLackingHub = false;
            if ((hubDuraion + cluster.hubDurations[closestHubIndex][1]) <= maxActiveTime) isLackingHub = true;

            if (isLackingHub) {
                // add more places to this hub to make it non lacking cluster
                const update = await addPlacesToHub(cluster.centroids[i], cluster.hubDurations[i], h, maxActiveTime);
                if (update) {
                    cluster.hubPlacesMapping[i] = update.places;
                    cluster.centroids[i] = update.centroid;
                    cluster.hubDurations[i] = update.hubDuration;
                    if (cluster.extraPlaces) {
                        cluster.extraPlaces = [...cluster.extraPlaces, ...update.extraPlaces];
                    } else {
                        cluster.extraPlaces = update.extraPlaces;
                    }
                }
            } else {
                // check if one day trip possible from current hub to the closest hub
                if (isOneDayTripPossible(cluster.centroids[i], cluster.centroids[closestHubIndex], v, maxActiveTime, cluster.hubDurations[i][1])) {
                    // merge current hub places with the closest hub
                    const thisHubPlaces = cluster.hubPlacesMapping[i];

                    // add to the closest hub
                    cluster.hubPlacesMapping[closestHubIndex] = cluster.hubPlacesMapping[closestHubIndex].concat(thisHubPlaces);
                    // update hubDuration
                    cluster.hubDurations[closestHubIndex][0] += cluster.hubDurations[i][0];
                    cluster.hubDurations[closestHubIndex][1] += cluster.hubDurations[i][1];

                    // remove this hub
                    indexesToRemove.push(i);
                } else {
                    // add extra places to fullfill this hub
                    const update = await addPlacesToHub(cluster.centroids[i], cluster.hubDurations[i], h, maxActiveTime);
                    if (update) {
                        cluster.hubPlacesMapping[i] = update.places;
                        cluster.centroids[i] = update.centroid;
                        cluster.hubDurations[i] = update.hubDuration;
                        if (cluster.extraPlaces) {
                            cluster.extraPlaces = [...cluster.extraPlaces, ...update.extraPlaces];
                        } else {
                            cluster.extraPlaces = update.extraPlaces;
                        }
                    }
                }
            }

        }
    }

    indexesToRemove.sort((a, b) => b - a);
    for (let i of indexesToRemove) {
        cluster.centroids.splice(i, 1);
        cluster.hubDurations.splice(i, 1);
        cluster.hubPlacesMapping.splice(i, 1);
    }

    return cluster;

}


module.exports = {
    cluster,
    getDurationAtHubs,
    getDurations,
    getHubPopularity,
    handleLackingClusters,
}