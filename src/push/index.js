const fs = require('fs');
const countBy = require('lodash.countby');
const webpush = require('web-push');
const Pushover = require('pushover-notifications');
const config = require('../../config.json');
const queries = require('../db/queries');
const slack = require('./slack');
const {
    send_file,
    send_string,
    error
} = require('../helper');

function init(app, db, awaiting_moderation) {
    // push notification apps
    const notifier = [];

    // each notification app could hook into the
    // the notifier array
    if (config.notify.pushover) {
        const push = new Pushover({
            token: config.notify.pushover.app_token,
            user: config.notify.pushover.user_key
        });
        notifier.push((msg, callback) => push.send(msg, callback));
    }

    if (config.notify.webpush) {
        webpush.setVapidDetails(
            config.schnack_host,
            config.notify.webpush.vapid_public_key,
            config.notify.webpush.vapid_private_key
        );

        notifier.push((msg, callback) => {
            db.each(queries.get_subscriptions, (err, row) => {
                if (error(err)) return;

                const subscription = {
                    endpoint: row.endpoint,
                    keys: {
                        p256dh: row.publicKey,
                        auth: row.auth
                    }
                };
                webpush.sendNotification(subscription, JSON.stringify({
                    title: 'schnack',
                    message: msg.message,
                    clickTarget: msg.url
                }));
            }, callback);
        });
    }

    setInterval(() => {
        let bySlug;
        if (awaiting_moderation.length) {
            bySlug = countBy(awaiting_moderation, 'slug');
            next();
            awaiting_moderation.length = 0;
        }
        function next(err) {
            const k = Object.keys(bySlug)[0];
            if (!k || err) return;
            db.get(queries.get_settings, 'notification', (err, row) => {
                if (err) console.error(err.message);
                const cnt = bySlug[k],
                    msg = {
                        message: `${cnt} new comment${cnt>1?'s':''} on "${k}" are awaiting moderation.`,
                        url: `/${k}`,
                        sound: !!row.active ? 'pushover' : 'none'
                    };
                delete bySlug[k];
                setTimeout(() => {
                    notifier.forEach((f) => f(msg, next));
                }, 1000);
            });
        }
    }, config.notification_interval || 300000); // five minutes

    // serve static js files
    app.use('/embed.js', send_file('build/embed.js'));
    app.use('/push.js', send_string(fs.readFileSync('src/embed/push.js', 'utf-8')
        .replace('%VAPID_PUBLIC_KEY%', config.notify.webpush.vapid_public_key)
        .replace('%SCHNACK_HOST%', config.schnack_host), true));

   // push notifications
   app.post('/subscribe', (request, reply) => {
    const { endpoint, publicKey, auth } = request.body;

    db.run(queries.subscribe, endpoint, publicKey, auth, (err) => {
        if (error(err, request, reply)) return;
        reply.send({ status: 'ok' });
        });
    });

    app.post('/unsubscribe', (request, reply) => {
        const { endpoint } = request.body;

        db.run(queries.unsubscribe, endpoint, (err) => {
            if (error(err, request, reply)) return;
            reply.send({ status: 'ok' });
        });
    });
}

module.exports = {
    init
};
