module.exports = app => {
    const userModel = require('mongoose').model('User');

    const api = {};
    const error = app.errors.users;

    api.create = (req, res) => {
        if(Array.isArray(req.body) || (req.body.constructor === Object && Object.keys(req.body).length === 0)) res.status(400).json(error.parse('users-1', new Error('This resource spect a JSON user object in the body request.')));
        else{
            if(req.body.groups) req.body.groups = [];
            userModel
                .create(req.body)
                .then(user => {
                    user.link = {
                        rel: 'user',
                        href: app.get('usersApiRoute') + '/' + user._id
                    };
                    user.save();
                    user = user.toObject();
                    delete user.password;
                    res.status(201).json({
                        userMessage: 'User '+ user.username +' was successfully created',
                        user
                    })
                }, err => {
                    switch(err.name) {
                        case 'ValidationError':
                            res.status(400).json(error.parse('users-2', err));
                            break;
                        case 'MongoError':
                            res.status(400).json(error.parse('users-3', err));
                            break;
                        default:
                            res.status(500).json(error.parse('users-4', err));
                    }
                });  
        }
    }

    api.list = (req, res) => {
        userModel
            .find({}).select('-password')
            .then(users => { res.json(users), err => res.status(500).json(error.parse('users-4', err))});

    }

    api.specificUser = (req, res) => {
        userModel
            .findById(req.params.id).select('-password')
            .then(user => {
                res.json(user);
            })
    }

    api.globalInfo = (req, res) => {
        userModel
            .aggregate([{$group: {_id: "$locInfo.country", count: {$sum: 1}, countryCode: {$last:"$locInfo.countryCode"}}}, {$sort: {"count":-1}}])
            .then(users => { res.json(users), err => res.status(500).json(error.parse('users-4', err))});
    }

    api.search = (req, res) => {
        userModel
            .find(req.query).select('-password')
            .then(user => {
                res.json(user), err => res.status(500).json(error.parse('users-4', err))
            });
    }

    return api;
}