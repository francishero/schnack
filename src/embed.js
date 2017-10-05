import {request,json} from 'd3-request';
import comments_tpl from './comments.jst.html';
import template from 'lodash.template';

(function() {

    var $ = (sel) => document.querySelector(sel),
        script = $('script[data-schnack-target]');

    if (!script) return console.warn('schnack script tag needs some data attributes');

    var opts = script.dataset,
        slug = opts.schnackSlug,
        endpoint = opts.schnackHost+'/comments/'+slug,
        target = opts.schnackTarget,
        tpl = template(comments_tpl);

    function refresh() {
        json(endpoint, (err, data) => {
            if (err) console.error(err);
            console.log(data);
            $(target).innerHTML = tpl(data);

            $(target + ' .schnack-button')
                .addEventListener('click', (d) => {
                    var body = $(target + ' .schnack-body').value;
                    request(endpoint)
                        .mimeType('application/json')
                        .header('Content-Type', 'application/json')
                        .post(JSON.stringify(body), (err, res) => {
                            if (err) console.error(err);
                            console.log(res);
                            refresh();
                        });
                });
        });
    }

    refresh();

})();