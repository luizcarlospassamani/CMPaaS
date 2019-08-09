module.exports = app => {
    const api = app.api.merge;

    app
        .route(app.get('mergeApiRoute'))
        .post(api.merge)
}
