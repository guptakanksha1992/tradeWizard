var moment = require("moment-timezone");

var TwapChildTrade = function (id, childQty, parentTrade, db) {
    this.id = id;
    this.parent = parentTrade;
    this.equityId = parentTrade.equityId;
    this.side = parentTrade.side;
    this.qty = childQty;
    this.uid = parentTrade.uid;
    this.price = parentTrade.price;
    this.parentTradeId = parentTrade.id;
    this.db = db;
    //todo: may not need to do the that = this
    var that = this;
    // var toSave = {
    //     parentTradeId : that.parentTradeId,
    //     uid : that.uid,
    //     status : "IN PROGRESS",
    //     childTrade : that.id
    // };
    // that.db.replies.save(toSave, function(err, doc) {
    //     if (err) {
    //         console.log("replies save callback error");
    //         console.log(err);
    //         console.log(doc);
    //     }
    // });

    this.afterSending = function(error, response, body) {
        console.log("response for child trade id#" + that.id +
            " of pt id#" + that.parentTradeId);
        console.log(body);
        try {
            var bodyAsJson = JSON.parse(body);
        } catch (e) {
            return console.error(e);
        }

        var response = Object.assign({
          readable_time : moment().tz("America/New_York").format("YYYY-MM-DD HH:mm z"),
          time : Date.now(),
          status : ((bodyAsJson.qty === 0) ? "FAILURE" : "SUCCESS"), //todo: remove this tmp fix for UI
        }, bodyAsJson);
        if (response.status === "SUCCESS") {
            that.parent.qtySoFar += that.qty;
        }
        if (that.parent.intervalsSoFar >= that.parent.totalIntervals) {
            if (that.parent.mailer) {
                console.log("trying to send mail");
                that.parent.mailer.sendParentTradeFinishedEmail(that.parent);
            } else {
                console.log("Would have sent an email");
            }

        }
        that.db.replies.findAndModify({
            query: { parentTradeId: that.parentTradeId, childTrade : that.id },
            update: { $set: response }
        },
        function(err, doc, lastErrorObject) {
            if (err) {
                console.log(err);
            }
        });
    };

};

TwapChildTrade.prototype.beforeSending = function () {
    var toSave = {
        parentTradeId : this.parentTradeId,
        childTradeId : this.id,
        equityId : this.equityId,
        price : this.price,
        uid : this.uid,
        qty : this.qty,
        side : this.side,
        dateSubmitted : Date.now()
    };
    this.db.sent.save(toSave, function(err, doc) {
        if (err) {
            console.log("replies callback error below then doc");
            console.log(err);
            console.log(doc);
        }
    });
};

TwapChildTrade.prototype.toQuery = function () {
    function objToParams (obj) {
        var params = "";
        for (var k in obj) {
            if (params != "") {
                params += "&"
            }
            params += k + "=" + encodeURIComponent(obj[k]);
        }
        return params;
    }
    function objToQuery (obj) {
        return "?" + objToParams(obj);
    }
    return objToQuery({
    id : this.equityId,
    price : this.price,
    qty : this.qty,
    side : this.side });
};

module.exports = TwapChildTrade;
