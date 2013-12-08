(function() {

  var guid = 0;

  function Signal () {
    var callbacks = [];

    this.fire = function (data) {
      callbacks.forEach(function (c) {c(data);});
    };

    this.add = function (callback) {
      callbacks.indexOf(callback) === -1 && callbacks.push(callback);
    };

    this.remove = function (callback) {
      var idx = callbacks.indexOf(callback);
      idx > -1 && callbacks.splice(idx, 1);
    };
  }

  function Action () {
    this.__guid = guid++;
    var that = this;
    this.isStarted = false;
    this.isPaused = false;
    this.isFinished = false;
    this.isBlocking = false;
    this.isComplete = false;
    this.parent = null;
    this.lane = null;
    this.onStarted = new Signal();
    this.onPaused = new Signal();
    this.onResumed = new Signal();
    this.onCompleted = new Signal();
    this.onCanceled = new Signal();
    this.onFinished = new Signal();
  }

  Action.prototype.start = function () {
    this.isStarted = true;
    this.onStarted.fire();
  };

  Action.prototype.pause = function () {
    this.isPaused = true;
    this.onPaused.fire();
  };

  Action.prototype.resume = function () {
    this.isPaused = false;
    this.onResumed.fire();
  };

  Action.prototype.cancel = function () {
    this.isFinished = true;
    this.onCanceled.fire();
    this.onFinished.fire();
  };

  Action.prototype.complete = function () {
    this.isFinished = true;
    this.unblock();
    this.onCompleted.fire();
    this.onFinished.fire();
  };

  Action.prototype.block = function () {
    this.isBlocking = true;
  };

  Action.prototype.unblock = function () {
    this.isBlocking = false;
  };

  Action.prototype.update = function () {

  };

  function ActionList (autoComplete) {
    Action.apply(this);
    this.lanes = {'default': []};
    this.autoComplete = !!autoComplete;
    this.isEmpty = true;
  }
  ActionList.prototype = Object.create(Action.prototype);

  ActionList.prototype.prepend = function (action, lane) {
    lane = lane || 'default';
    this.lanes[lane] = this.lanes[lane] || [];
    this.lanes[lane].unshift(action);
    this.isEmpty = false;
    action.parent = this;
    action.lane = lane;
  };

  ActionList.prototype.append = function (action, lane) {
    lane = lane || 'default';
    this.lanes[lane] = this.lanes[lane] || [];
    this.lanes[lane].push(action);
    this.isEmpty = false;
    action.parent = this;
    action.lane = lane;
  };

  ActionList.prototype.update = function (dt) {
    if (this.isPaused || this.isFinished) return;

    var laneKeys = Object.keys(this.lanes);
    var lanes = this.lanes;

    laneKeys.forEach(function (laneKey) {
      var lane = lanes[laneKey];
      var action, i, l;

      for (i = 0, l = lane.length; i < l; ++i) {
        action = lane[i];
        if (!action.isPaused && !action.isFinished) {
          if (!action.isStarted) {
            action.start();
          }

          if (action.isFinished) { continue; }

          action.update(dt);
        }

        if (action.isFinished) { continue; }
        if (action.isBlocking) { break; }
      }

      // Remove finished actions
      for (i = lane.length - 1; i > -1; --i) {
        if (lane[i].isFinished) {
          lane.splice(i, 1);
        }
      }

      if (lane.length === 0) {
        delete this.lane;
      }
    });

    if (Object.keys(this.lanes) === 0) {
      if (this.autoComplete) {
        this.complete();
      }

      this.isEmpty = true;
    }
  };

  ['pause', 'resume', 'cancel', 'block', 'unblock'].forEach(function (key) {
    ActionList.prototype[key + 'Lane'] = function (lane) {
      if (Array.isArray(this.lanes[lane])) {
        this.lanes[lane].forEach(function (a) {a[key]();})
      }
    };
  });

  ActionList.serial = function (actions, lane) {
    var list = new ActionList(true);
    actions.forEach(function (a) {
      a.block();
      list.append(a, lane);
    });
    return list;
  };

  ActionList.parallel = function (actions, lane) {
    var list = new ActionList(true);
    actions.forEach(function (a) {
      a.unblock();
      list.append(a, lane);
    });
    return list;
  };

  window.ActionList = ActionList;
  window.Action = Action;
})();