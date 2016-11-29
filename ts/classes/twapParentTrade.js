var request = require("request");
var TwapChildTrade = require('./twapChildTrade.js');
var moment = require('moment-timezone');

var TwapParentTrade =
    function (id, eqId, qty, side, exchange, db) {
        //direct parameter assignment
        this.id = id;  //save
        this.equityId = eqId; //save
        this.side = side; //save
        this.qty = qty; //save
        this.exchange = exchange;
        this.db = db;

        //other assignment based on parameters
        this.qtyLeft = parseInt(this.qty);
        this.price = "0";
        if (this.side == "buy") {
            this.price = "2147483647"; //max 32 bit int
        }

        //other assignments
        this.totalIntervals = 10;
        this.intervalsSoFar = 0;

        var that = this;
        request((that.exchange.location + '/query?id=1'), function (err, res, body) {
            try {
                var bodyAsJson = JSON.parse(body);
            } catch (e) {
                console.log(body);
                return console.error(e);
            }
            var currentTime = (new Date(bodyAsJson.timestamp)).getTime(); //in ms
            //08:30:00 for production
            var endTime = (new Date("2016-10-28 00:30:30")).getTime();
            that.intervalLength = Math.floor((endTime -
                currentTime)/that.totalIntervals); //in ms
            var toSave = {
                pid : that.id,
                equityId : that.equityId,
                side : that.side,
                qty : that.qty,
                time : moment().tz("America/New_York").format("YYYY-MM-DD HH:mm z")
            };

            that.db.parents.save (toSave, function (err, doc) {
                if (err) {
                    console.log("parent not saved");
                    console.log(err);
                    console.log(doc);
                }
            });
            //first trade
            that.makeTrade();

            //set up other trades
            var pt = that;
            that.tradeTimer = setInterval(function() {
                if (pt.intervalsSoFar >= pt.totalIntervals - 1) {
                    pt.stop();
                }
                pt.makeTrade();
            }, that.intervalLength);
        });
    };

    TwapParentTrade.prototype.intervalsRemaining = function () {
        return this.totalIntervals - this.intervalsSoFar;
    };

    TwapParentTrade.prototype.finishNow = function () {
        //flexible so if a trade doesn't work TWAP can still be used.
        var qtyToTrade = this.qtyLeft;
        var currentChildTrade = new TwapChildTrade(this.intervalsSoFar,
            qtyToTrade, this, this.db);
        this.intervalsSoFar++;
        this.exchange.submitTrade(currentChildTrade, this.db);
        return "Finishing now";
    };

    TwapParentTrade.prototype.stop = function () {
        clearInterval(this.tradeTimer);
        return "Stop an twap trade."
    };

    TwapParentTrade.prototype.makeTrade = function () {
        //flexible so if a trade doesn't work TWAP can still be used.
        var qtyToTrade = Math.ceil(this.qtyLeft/this.intervalsRemaining());
        console.log(qtyToTrade);
        var currentChildTrade = new TwapChildTrade(this.intervalsSoFar,
            qtyToTrade, this, this.db);
        console.log(currentChildTrade);
        this.intervalsSoFar++;
        this.exchange.submitTrade(currentChildTrade, this.db);
    };

module.exports = TwapParentTrade;