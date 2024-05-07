// let there be luck for anyone trying to read whatever the fuck I wrote below
// if it works it works, they say
// EDIT: done some small refactoring, should be slightly more readable now

const http = require("http");
const fs = require("fs/promises");
const URL = require("url");
const path = require("path");

let mime_type = {};

fetch("https://cdn.jsdelivr.net/gh/jshttp/mime-db@master/db.json").then(async data => {
    data = await data.json();
    for (let key in data) {
        let extensions = data[key].extensions;
        if (!Array.isArray(extensions)) continue;
        for (let extension of extensions) {
            mime_type[extension] = key;
        }
    }
}).catch(console.err);

Array.prototype.last = function () { return this[this.length - 1]; };

const server = new http.Server(async (req, res) => {
    try {

        const url = URL.parse(req.url);

        let request_path = (process.argv[2] || __dirname) + decodeURI(url.pathname);
        console.log(request_path);
        if (request_path.endsWith("/")) request_path = request_path.slice(0, -1);

        const request_stats = await fs.stat(request_path);
        if (request_stats.isFile()) {
            const data = await fs.readFile(request_path);

            res.setHeader("Content-Type", mime_type[request_path.split(".").last()] || "text/plain; charset=utf-8");
            res.statusCode = 200;
            res.end(data);
        } else if (request_stats.isDirectory()) {
            let data = await fs.readdir(request_path);

            /** @type{ {[key: string]: import("fs").Stats} } */
            let stats = {};
            await Promise.all(data.map(async filename => {
                let full_filename = path.join(request_path, filename);
                stats[filename] = await fs.lstat(full_filename);
            }));

            data.sort((a, b) => {
                if (a == b) return 0;
                let sort = [a, b].sort();
                let return_value = sort[0] == a ? -1 : 1;

                if (stats[b].isDirectory() && !stats[a].isDirectory()) return 1;
                if (stats[a].isDirectory() && !stats[b].isDirectory()) return -1;

                return return_value;
            });
            data = data.map(filename => {
                return `<a href="${filename}">${filename + (stats[filename].isDirectory() ? "/" : "")}</a>`;
            });
            data = data.join("<br>");
            data = `
                <base id="b"><script>document.getElementById("b").href = location.href.endsWith("/") ? location.href : location.href + "/";</script>
                <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Roboto+Mono">
                <style>a { color: rgb(0,0,238); font-family: 'Roboto Mono', monospace; }</style>
                <a href="../">../</a><br>`
                + data;

            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.statusCode = 200;
            res.end(data);
        } else {
            res.statusCode = 501;
            res.end();
        }
    } catch(err) {
        if (err?.code == "ENOENT") {
            res.statusCode = 404;
        } else if (err?.code == "EACCES") {
            res.statusCode = 403;
        }
        res.end();
    }
});

server.listen(3000);
