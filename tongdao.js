(function umd(require){
	if ('object' == typeof exports) {
		module.exports = require('1');
	} else if ('function' == typeof define && define.amd) {
		define(function(){ return require('1'); });
	} else {
		this['tongdao'] = require('1');
	}
})((function outer(modules, cache, entries){

	/**
	 * Global
	 */

	var global = (function(){ return this; })();

	/**
	 * Require `name`.
	 *
	 * @param {String} name
	 * @param {Boolean} jumped
	 * @api public
	 */

	function require(name, jumped){
		if (cache[name]) return cache[name].exports;
		if (modules[name]) return call(name, require);
		throw new Error('cannot find module "' + name + '"');
	}

	/**
	 * Call module `id` and cache it.
	 *
	 * @param {Number} id
	 * @param {Function} require
	 * @return {Function}
	 * @api private
	 */

	function call(id, require){
		var m = cache[id] = { exports: {} };
		var mod = modules[id];
		var name = mod[2];
		var fn = mod[0];

		fn.call(m.exports, function(req){
			var dep = modules[id][1][req];
			return require(dep ? dep : req);
		}, m, m.exports, outer, modules, cache, entries);

		// expose as `name`.
		if (name) cache[name] = cache[id];

		return cache[id].exports;
	}

	/**
	 * Require all entries exposing them on global if needed.
	 */

	for (var id in entries) {
		if (entries[id]) {
			global[entries[id]] = require(id);
		} else {
			require(id);
		}
	}

	/**
	 * Duo flag.
	 */

	require.duo = true;

	/**
	 * Expose cache.
	 */

	require.cache = cache;

	/**
	 * Expose modules
	 */

	require.modules = modules;

	/**
	 * Return newest require.
	 */

	 return require;
})({
1: [function(require, module, exports) {
/* jshint expr:true */

var TongDao = require('./tongdao');

var old = window.tongdao || {};
var instance = new TongDao();
instance._q = old._q || [];

// export the instance
module.exports = instance;

}, {"./tongdao":2}],
2: [function(require, module, exports) {
var Cookie = require('./cookie');
var JSON = require('json'); // jshint ignore:line
var language = require('./language');
var localStorage = require('./localstorage');  // jshint ignore:line
var md5 = require('JavaScript-MD5');
var object = require('object');
var Request = require('./xhr');
var UAParser = require('ua-parser-js');
var UUID = require('./uuid');
var version = require('./version');
var Identify = require('./identify');
var type = require('./type');

var log = function(s) {
	console.log('[TongDao] ' + s);
};

var IDENTIFY_EVENT = '$identify';
var API_VERSION = 2;
var MAX_STRING_LENGTH = 1024;
var DEFAULT_OPTIONS = {
	apiEndpoint: 'https://api.tongrd.com/v2/events',
	cookieExpiration: 365 * 5,
	cookieName: 'tongdao_id',
	domain: undefined,
	includeUtm: false,
	language: language.language,
	optOut: false,
	platform: 'Web',
	savedMaxCount: 1000,
	saveEvents: true,
	sessionTimeout: 30 * 60 * 1000,
	unsentKey: 'tongdao_unsent',
	unsentIdentifyKey: 'tongdao_unsent_identify',
	uploadBatchSize: 100,
	batchEvents: false,
	eventUploadThreshold: 30,
	eventUploadPeriodMillis: 30 * 1000 // 30s
};
var LocalStorageKeys = {
	LAST_EVENT_ID: 'tongdao_lastEventId',
	LAST_IDENTIFY_ID: 'tongdao_lastIdentifyId',
	LAST_SEQUENCE_NUMBER: 'tongdao_lastSequenceNumber',
	LAST_EVENT_TIME: 'tongdao_lastEventTime',
	SESSION_ID: 'tongdao_sessionId',

	DEVICE_ID: 'tongdao_deviceId',
	USER_ID: 'tongdao_userId',
	COOKIE_ID: 'tongdao_cookieId',
	OPT_OUT: 'tongdao_optOut'
};

/*
 * TongDao API
 */
var TongDao = function() {
	this._unsentEvents = [];
	this._unsentIdentifys = [];
	this._ua = new UAParser(navigator.userAgent).getResult();
	this.options = object.merge({}, DEFAULT_OPTIONS);
	this._q = []; // queue for proxied functions before script load
};

TongDao.prototype._eventId = 0;
TongDao.prototype._identifyId = 0;
TongDao.prototype._sequenceNumber = 0;
TongDao.prototype._sending = false;
TongDao.prototype._lastEventTime = null;
TongDao.prototype._sessionId = null;
TongDao.prototype._newSession = false;
TongDao.prototype._updateScheduled = false;

TongDao.prototype.Identify = Identify;

/**
 * Initializes TongDao.
 * appKey The X-APP-KEY for your app
 * opt_userId An identifier for this user
 * opt_config Configuration options
 *   - saveEvents (boolean) Whether to save events to local storage. Defaults to true.
 *   - includeUtm (boolean) Whether to send utm parameters with events. Defaults to false.
 *   - includeReferrer (boolean) Whether to send referrer info with events. Defaults to false.
 */
TongDao.prototype.init = function(appKey, opt_userId, opt_config, callback) {
	var scope = this;
	log('init');
	try {
		this.options.appKey = appKey;
	if (opt_config) {
		if (opt_config.saveEvents !== undefined) {
			this.options.saveEvents = !!opt_config.saveEvents;
		}
		if (opt_config.domain !== undefined) {
			this.options.domain = opt_config.domain;
		}
		if (opt_config.includeUtm !== undefined) {
			this.options.includeUtm = !!opt_config.includeUtm;
		}
		if (opt_config.includeReferrer !== undefined) {
			this.options.includeReferrer = !!opt_config.includeReferrer;
		}
		if (opt_config.batchEvents !== undefined) {
			this.options.batchEvents = !!opt_config.batchEvents;
		}
		this.options.platform = opt_config.platform || this.options.platform;
		this.options.language = opt_config.language || this.options.language;
		this.options.sessionTimeout = opt_config.sessionTimeout || this.options.sessionTimeout;
		this.options.uploadBatchSize = opt_config.uploadBatchSize || this.options.uploadBatchSize;
		this.options.eventUploadThreshold = opt_config.eventUploadThreshold || this.options.eventUploadThreshold;
		this.options.savedMaxCount = opt_config.savedMaxCount || this.options.savedMaxCount;
		this.options.eventUploadPeriodMillis = opt_config.eventUploadPeriodMillis || this.options.eventUploadPeriodMillis;
	}

	Cookie.options({
		expirationDays: this.options.cookieExpiration,
		domain: this.options.domain
	});
	this.options.domain = Cookie.options().domain;

	_migrateLocalStorageDataToCookie(this);
	_loadCookieData(this);

	// CHECK FOR PREVIOUS USER/DEVICE ID BEFORE CREATING ONE > IF NONE, MARK AS NEW USER
	var newUser;
	if ( !this.options.deviceId ) {
		log('New User');
		newUser = true;
	}

	// IF NO PREVIOUS DEVICE ID FOUND > SET DEVICE ID AS GENERATED (md5) UUID
	this.options.deviceId = (opt_config && opt_config.deviceId !== undefined &&
		opt_config.deviceId !== null && opt_config.deviceId) ||
		this.options.deviceId || md5(UUID());

	this.options.userId = (opt_userId !== undefined && opt_userId !== null && opt_userId) || this.options.userId || null;

	// IF NO PREVIOUS COOKIE ID > SET AS DEVICE ID 
	this.options.cookieId = ( this.options.cookieId || this.options.deviceId );

	_saveCookieData(this);

	// log(':243 initialized with appKey=' + appKey);
	//opt_userId !== undefined && opt_userId !== null && log('initialized with userId=' + opt_userId);

	if (this.options.saveEvents) {
		this._loadSavedUnsentEvents(this.options.unsentKey, '_unsentEvents');
		this._loadSavedUnsentEvents(this.options.unsentIdentifyKey, '_unsentIdentifys');
	}

	this._sendEventsIfReady();

	if (this.options.includeUtm) {
		this._initUtmData();
	}

	this._lastEventTime = parseInt(localStorage.getItem(LocalStorageKeys.LAST_EVENT_TIME)) || null;
	this._sessionId = parseInt(localStorage.getItem(LocalStorageKeys.SESSION_ID)) || null;
	this._eventId = localStorage.getItem(LocalStorageKeys.LAST_EVENT_ID) || 0;
	this._identifyId = localStorage.getItem(LocalStorageKeys.LAST_IDENTIFY_ID) || 0;
	this._sequenceNumber = localStorage.getItem(LocalStorageKeys.LAST_SEQUENCE_NUMBER) || 0;
	var now = new Date().getTime();
	if (!this._sessionId || !this._lastEventTime || now - this._lastEventTime > this.options.sessionTimeout) {
		this._newSession = true;
		this._sessionId = now;
		localStorage.setItem(LocalStorageKeys.SESSION_ID, this._sessionId);
	}
		this._lastEventTime = now;
		localStorage.setItem(LocalStorageKeys.LAST_EVENT_TIME, this._lastEventTime);
	} catch (e) {
		log( 'init: ' + e );
	}

	if (callback && type(callback) === 'function') {
		callback();
	}

	// IF FIRST TIME/NEW USER > LOG IDENTIFY INFORMATION
	if ( newUser ) {
		var eventProperties = {
			"!device":{
				"!browser_name": this._ua.browser.name || null,
				"!browser_version": this._ua.browser.major || null,
				"!os_name": this._ua.os.name || null,
				"!os_version": this._ua.os.version || null,
				"!language": this.options.language,
			},
			"!fingerprint": {
				"!coid": this.options.cookieId
			}
		};

		this._logEvent( 'identify', null, eventProperties );
	}

	// ACTIVATE PAGEVIEW EVENTS
	// TODO: SET BEHAVIOR OR SINGLE PAGE APPLICATIONS
	window.onload = function(){
		// RUN INITIAL PAGE OPEN EVENT
		scope._openPage();
		// START LISTENING FOR HASH/ROUTE CHANGES
		scope._routeHandler();
	};

};

TongDao.prototype._openPage = function () {
	var scope = this;
	
	// SENDS TWO EVENTS TO DETERMINE SESSIONS > !open_page & !close_page
	// GET THE OPEN_PAGE STARTED AT TIMESTAMP
	this.options.startedAt = new Date().toISOString();
	// SEND OPENPAGE EVENT

	var openedPage = document.createElement('a');
	openedPage.href = window.location.href;

	// SAVED TO OPTIONS FOR BROADER USAGE SCORE
	this.options.openedPath = openedPage.pathname + openedPage.hash;

	// log('Currently Viewing: ' + this.options.openedPath );
	var eventProperties = {
		"!name": scope.options.openedPath
	};

	this._logEvent('track', '!open_page', eventProperties );

	// ON UNLOAD > TRIGGERS CLOSE PAGE TRACK EVENT
	window.onbeforeunload = function () {
			scope._closePage( scope.options.openedPath, scope.options.startedAt, true );
	};
};

TongDao.prototype._closePage = function ( pathname, startedAt, unLoad ) {
	var scope = this;
	// IF CLOSE EVENT IS A PAGE UNLOAD, SET onUnloadEvent TO TRUE
	// THIS WILL ALLOW THE FINAL DATA SEND TO BE SYNCHRONOUS AND WAIT FOR RESPONSE
	if ( unLoad ) this.options.onUnloadEvent = true;

	var eventProperties = {
		"!name": pathname,
		"!started_at": startedAt
	};

	this._logEvent('track', '!close_page', eventProperties, null, null, function(){
		// log('Close_Page sent');
		if ( !unLoad ) scope._openPage();
	});

};

TongDao.prototype._routeHandler = function () {
	var scope = this;
	// USE HISTORY STATE CHANGE TO DETERMINE ROUTING CHANGES
	if ( history.pushState ) {
		var pushState = window.history.pushState;
	  history.pushState = function(state) {
	      if (typeof history.onpushstate == "function") {
	          history.onpushstate({state: state});
	      }
	      return pushState.apply(history, arguments);
	  }
	  // ANY ADDITION TO HISTORY TRIGGERS POP STATE > SENDS OPEN/CLOSE ACTIONS
	  // TO HANDLE ROUTING AND HASHCHANGES
		window.onpopstate = history.onpushstate = function(e) {
				var newPage = window.location;
				if ( (newPage.pathname + newPage.hash) === scope.options.openedPath ) return;
		    scope._closePage( scope.options.openedPath, scope.options.startedAt, false );
		};
	}
	// FALLBACK FOR UNSUPPORTED BROWSERS
	else {
		var oldUrl = window.location.href;
		var checkUrl = setInterval(function(){ detect() }, 200);
    var detect = function(){
      if( oldUrl != window.location.href ){
          scope._closePage( scope.options.openedPath, scope.options.startedAt, false );
          oldUrl = window.location.href;
      }
    };

	}

};

TongDao.prototype.runQueuedFunctions = function () {
	for (var i = 0; i < this._q.length; i++) {
			var fn = this[this._q[i][0]];
			if (fn && type(fn) === 'function') {
					fn.apply(this, this._q[i].slice(1));
			}
	}
	this._q = []; // clear function queue after running
};

TongDao.prototype._loadSavedUnsentEvents = function(unsentKey, queue) {
	var savedUnsentEventsString = localStorage.getItem(unsentKey);
	if (savedUnsentEventsString) {
		try {
			this[queue] = JSON.parse(savedUnsentEventsString);
		} catch (e) {
			log('_loadSavedUnsentEvents: ' + e);
		}
	}
};

TongDao.prototype.isNewSession = function() {
	return this._newSession;
};

TongDao.prototype.nextEventId = function() {
	this._eventId++;
	return this._eventId;
};

TongDao.prototype.nextIdentifyId = function() {
	this._identifyId++;
	return this._identifyId;
};

TongDao.prototype.nextSequenceNumber = function() {
	this._sequenceNumber++;
	return this._sequenceNumber;
};

// returns the number of unsent events and identifys
TongDao.prototype._unsentCount = function() {
	return this._unsentEvents.length + this._unsentIdentifys.length;
};

// returns true if sendEvents called immediately
TongDao.prototype._sendEventsIfReady = function(callback) {
	if (this._unsentCount() === 0) {
		return false;
	}

	if (!this.options.batchEvents) {
		this.sendEvents(callback);
		return true;
	}

	if (this._unsentCount() >= this.options.eventUploadThreshold) {
		this.sendEvents(callback);
		return true;
	}

	if (!this._updateScheduled) {
		this._updateScheduled = true;
		setTimeout(
			function() {
				this._updateScheduled = false;
				this.sendEvents();
			}.bind(this), this.options.eventUploadPeriodMillis
		);
	}

	return false;
};

var _migrateLocalStorageDataToCookie = function(scope) {
	var cookieData = Cookie.get(scope.options.cookieName);
	if (cookieData && cookieData.deviceId) {
		return; // migration not needed
	}

	var cookieDeviceId = (cookieData && cookieData.deviceId) || null;
	var cookieUserId = (cookieData && cookieData.userId) || null;
	var cookieCookieId = (cookieData && cookieData.cookieId) || null;
	var cookieOptOut = (cookieData && cookieData.optOut !== null && cookieData.optOut !== undefined) ?
			cookieData.optOut : null;

	var keySuffix = '_' + scope.options.appKey.slice(0, 6);
	var localStorageDeviceId = localStorage.getItem(LocalStorageKeys.DEVICE_ID + keySuffix);
	if (localStorageDeviceId) {
		localStorage.removeItem(LocalStorageKeys.DEVICE_ID + keySuffix);
	}
	var localStorageUserId = localStorage.getItem(LocalStorageKeys.USER_ID + keySuffix);
	if (localStorageUserId) {
		localStorage.removeItem(LocalStorageKeys.USER_ID + keySuffix);
	}
	var localStorageCookieId = localStorage.getItem(LocalStorageKeys.COOKIE_ID + keySuffix);
	if (localStorageCookieId) {
		localStorage.removeItem(LocalStorageKeys.COOKIE_ID + keySuffix);
	}
	var localStorageOptOut = localStorage.getItem(LocalStorageKeys.OPT_OUT + keySuffix);
	if (localStorageOptOut !== null && localStorageOptOut !== undefined) {
		localStorage.removeItem(LocalStorageKeys.OPT_OUT + keySuffix);
		localStorageOptOut = String(localStorageOptOut) === 'true'; // convert to boolean
	}

	Cookie.set(scope.options.cookieName, {
		deviceId: cookieDeviceId || localStorageDeviceId,
		userId: cookieUserId || localStorageUserId,
		cookieId: cookieCookieId || localStorageCookieId,
		optOut: (cookieOptOut !== undefined && cookieOptOut !== null) ? cookieOptOut : localStorageOptOut
	});
};

var _loadCookieData = function(scope) {
	var cookieData = Cookie.get(scope.options.cookieName);
	if (cookieData) {
		if (cookieData.deviceId) {
			scope.options.deviceId = cookieData.deviceId;
		}
		if (cookieData.userId) {
			scope.options.userId = cookieData.userId;
		}
		if (cookieData.cookieId) {
			scope.options.cookieId = cookieData.cookieId;
		}
		if (cookieData.optOut !== null && cookieData.optOut !== undefined) {
			scope.options.optOut = cookieData.optOut;
		}
	}
};

var _saveCookieData = function(scope) {
	Cookie.set(scope.options.cookieName, {
		deviceId: scope.options.deviceId,
		userId: scope.options.userId,
		cookieId: scope.options.cookieId,
		optOut: scope.options.optOut
	});
};

TongDao._getUtmParam = function(name, query) {
	name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
	var regex = new RegExp("[\\?&]" + name + "=([^&#]*)");
	var results = regex.exec(query);
	return results === null ? undefined : decodeURIComponent(results[1].replace(/\+/g, " "));
};

TongDao._getUtmData = function(rawCookie, query) {
	// Translate the utmz cookie format into url query string format.
	var cookie = rawCookie ? '?' + rawCookie.split('.').slice(-1)[0].replace(/\|/g, '&') : '';

	var fetchParam = function (queryName, query, cookieName, cookie) {
		return TongDao._getUtmParam(queryName, query) ||
					 TongDao._getUtmParam(cookieName, cookie);
	};

	return {
		utm_source: fetchParam('utm_source', query, 'utmcsr', cookie),
		utm_medium: fetchParam('utm_medium', query, 'utmcmd', cookie),
		utm_campaign: fetchParam('utm_campaign', query, 'utmccn', cookie),
		utm_term: fetchParam('utm_term', query, 'utmctr', cookie),
		utm_content: fetchParam('utm_content', query, 'utmcct', cookie),
	};
};

/**
 * Parse the utm properties out of cookies and query for adding to user properties.
 */
TongDao.prototype._initUtmData = function(queryParams, cookieParams) {
	queryParams = queryParams || location.search;
	cookieParams = cookieParams || Cookie.get('__utmz');
	this._utmProperties = TongDao._getUtmData(cookieParams, queryParams);
};

TongDao.prototype._getReferrer = function() {
	return document.referrer;
};

TongDao.prototype._getReferringDomain = function() {
	var parts = this._getReferrer().split("/");
	if (parts.length >= 3) {
		return parts[2];
	}
	return "";
};

TongDao.prototype.saveEvents = function() {
	try {
		localStorage.setItem(this.options.unsentKey, JSON.stringify(this._unsentEvents));
		localStorage.setItem(this.options.unsentIdentifyKey, JSON.stringify(this._unsentIdentifys));
	} catch (e) {
		log( 'saveEvents: ' + e );
	}
};

TongDao.prototype.setDomain = function(domain) {
	try {
		Cookie.options({
			domain: domain
		});
		this.options.domain = Cookie.options().domain;
		_loadCookieData(this);
		_saveCookieData(this);
		//log('set domain=' + domain);
	} catch (e) {
		log( 'setDomain: ' + e );
	}
};

TongDao.prototype.setUserId = function(userId) {
	try {
		this.options.userId = (userId !== undefined && userId !== null && ('' + userId)) || null;
		_saveCookieData(this);
		// log('set userId=' + userId);
		this.setUserProperties({ user_id: userId, previous_id: this.options.deviceId });
	} catch (e) {
		log( 'setUserId: ' + e );
	}
};

TongDao.prototype.setOptOut = function(enable) {
	try {
		this.options.optOut = enable;
		_saveCookieData(this);
		//log('set optOut=' + enable);
	} catch (e) {
		log( 'setOptOut: ' + e );
	}
};

TongDao.prototype.setDeviceId = function(deviceId) {
	try {
		if (deviceId) {
			this.options.deviceId = ('' + deviceId);
			_saveCookieData(this);
		}
	} catch (e) {
		log( 'setDeviceId: ' + e );
	}
};

TongDao.prototype.setUserProperties = function(userProperties) {
	// convert userProperties into an identify call
	var identify = new Identify();
	for (var property in userProperties) {
		if (userProperties.hasOwnProperty(property)) {
			identify.set(property, userProperties[property]);
		}
	}
	this.identify(identify, userProperties);
};

TongDao.prototype.identify = function(identify, userProperties) {

	if (type(identify) === 'object' && '_q' in identify) {
		var instance = new Identify();
		// Apply the queued commands
		for (var i = 0; i < identify._q.length; i++) {
				var fn = instance[identify._q[i][0]];
				if (fn && type(fn) === 'function') {
					fn.apply(instance, identify._q[i].slice(1));
				}
		}
		identify = instance;
	}
	if (identify instanceof Identify && Object.keys(identify.userPropertiesOperations).length > 0) {
		this._logEvent('merge', null, null, null, userProperties, identify.userPropertiesOperations);
	}
};

TongDao.prototype.setVersionName = function(versionName) {
	try {
		this.options.versionName = versionName;
		//log('set versionName=' + versionName);
	} catch (e) {
		log( 'setVersionName' + e );
	}
};

// truncate string values in event and user properties so that request size does not get too large
TongDao.prototype._truncate = function(value) {
	if (type(value) === 'array') {
		for (var i = 0; i < value.length; i++) {
			value[i] = this._truncate(value[i]);
		}
	} else if (type(value) === 'object') {
		for (var key in value) {
			if (value.hasOwnProperty(key)) {
				value[key] = this._truncate(value[key]);
			}
		}
	} else {
		value = _truncateValue(value);
	}

	return value;
};

var _truncateValue = function(value) {
	if (type(value) === 'string') {
		return value.length > MAX_STRING_LENGTH ? value.substring(0, MAX_STRING_LENGTH) : value;
	}
	return value;
};

/**
 * Private track method. Keeps apiProperties from being publicly exposed.
 */
TongDao.prototype._logEvent = function( action, eventType, eventProperties, apiProperties, userProperties, callback) {
	// CHECK TO SEE IF PROPERTIES ARE AN OBJECT
	if ( eventProperties && type(eventProperties) !== 'object' ) {
		throw new Error('Track Event ' + eventType + ': properties not an object');
		return;
	}

	if (type(callback) !== 'function') {
		callback = null;
	}

	if (!action || this.options.optOut) {
		if (callback) {
			callback(0, 'No request sent');
		}
		return;
	}
	try {
		var eventId;
		if (action === IDENTIFY_EVENT) {
			eventId = this.nextIdentifyId();
			localStorage.setItem(LocalStorageKeys.LAST_IDENTIFY_ID, eventId);
		} else {
			eventId = this.nextEventId();
			localStorage.setItem(LocalStorageKeys.LAST_EVENT_ID, eventId);
		}
		var eventTime = new Date().getTime();
		var timestamp = new Date().toISOString();

		var ua = this._ua;
		if (!this._sessionId || !this._lastEventTime || eventTime - this._lastEventTime > this.options.sessionTimeout) {
			this._sessionId = eventTime;
			localStorage.setItem(LocalStorageKeys.SESSION_ID, this._sessionId);
		}
		this._lastEventTime = eventTime;
		localStorage.setItem(LocalStorageKeys.LAST_EVENT_TIME, this._lastEventTime);

		userProperties = userProperties || {};

		// Only add utm properties to user properties for events
		// if (action !== IDENTIFY_EVENT) {
		// 	object.merge(userProperties, this._utmProperties);

		// 	// Add referral info onto the user properties
		// 	if (this.options.includeReferrer) {
		// 		object.merge(userProperties, {
		// 			'referrer': this._getReferrer(),
		// 			'referring_domain': this._getReferringDomain()
		// 		});
		// 	}
		// }

		// apiProperties = apiProperties || {};
		eventProperties = eventProperties || {};
		// BUILD DATA HAS TO BE SENT AS JSON TO API
		var data = {
			action: action,
				user_id: this.options.userId || this.options.deviceId,
				properties: eventProperties,
				timestamp: timestamp,
			// event_id: eventId,
			// session_id: this._sessionId || -1,
			// event_type: eventType,
			// version_name: this.options.versionName || null,
			// api_properties: apiProperties,
			// event_properties: this._truncate(eventProperties),
			// user_properties: this._truncate(userProperties),
			// uuid: UUID(),
			// sequence_number: this.nextSequenceNumber() // for ordering events and identifys
			// country: null
		};

		// ADD event: KEY ONLY IF THERE IS AN EVENT NAME VALUE
		if ( eventType ) data.event = eventType;

		if( userProperties ){
			for ( var property in userProperties ){
				if ( !data[property] ) data[property] = userProperties[property];
			}
		}

		if (action === IDENTIFY_EVENT) {
			this._unsentIdentifys.push(data);
			this._limitEventsQueued(this._unsentIdentifys);
		} else {
			this._unsentEvents.push(data);
			this._limitEventsQueued(this._unsentEvents);
		}

		if (this.options.saveEvents) {
			this.saveEvents();
		}

		if (!this._sendEventsIfReady(callback) && callback) {
			callback(0, 'No request sent');
		}

		return eventId;
	} catch (e) {
		log( '_logEvent: ' + e );
	}
};

// Remove old events from the beginning of the array if too many
// have accumulated. Don't want to kill memory. Default is 1000 events.
TongDao.prototype._limitEventsQueued = function(queue) {
	if (queue.length > this.options.savedMaxCount) {
		queue.splice(0, queue.length - this.options.savedMaxCount);
	}
};

TongDao.prototype.track = function(eventType, eventProperties, callback) {
	// console.log('%cPublic Event Logged: ' + eventType, 'background:violet;');
	return this._logEvent( 'track' , eventType, eventProperties, null, null, callback);
};

// Test that n is a number or a numeric value.
var _isNumber = function(n) {
	return !isNaN(parseFloat(n)) && isFinite(n);
};

TongDao.prototype.logRevenue = function(price, quantity, product) {
	// Test that the parameters are of the right type.
	if (!_isNumber(price) || quantity !== undefined && !_isNumber(quantity)) {
		// log('Price and quantity arguments to logRevenue must be numbers');
		return;
	}

	return this._logEvent('track', 'revenue_amount', {}, {
		productId: product,
		special: 'revenue_amount',
		quantity: quantity || 1,
		price: price
	});
};

/**
 * Remove events in storage with event ids up to and including maxEventId. Does
 * a true filter in case events get out of order or old events are removed.
 */
TongDao.prototype.removeEvents = function (maxEventId, maxIdentifyId) {
	if (maxEventId >= 0) {
		var filteredEvents = [];
		for (var i = 0; i < this._unsentEvents.length; i++) {
			if (this._unsentEvents[i].event_id > maxEventId) {
				filteredEvents.push(this._unsentEvents[i]);
			}
		}
		this._unsentEvents = filteredEvents;
	}

	if (maxIdentifyId >= 0) {
		var filteredIdentifys = [];
		for (var j = 0; j < this._unsentIdentifys.length; j++) {
			if (this._unsentIdentifys[j].event_id > maxIdentifyId) {
				filteredIdentifys.push(this._unsentIdentifys[j]);
			}
		}
		this._unsentIdentifys = filteredIdentifys;
	}
};

TongDao.prototype.sendEvents = function(callback) {
	if ( !this.options.optOut && this._unsentCount() > 0) {

		var url = this.options.apiEndpoint ;

		// fetch events to send
		var numEvents = Math.min(this._unsentCount(), this.options.uploadBatchSize);
		var mergedEvents = this._mergeEventsAndIdentifys(numEvents);
		var maxEventId = mergedEvents.maxEventId;
		var maxIdentifyId = mergedEvents.maxIdentifyId;
		var events = mergedEvents.eventsToSend;
		var appKey = this.options.appKey;
		var onUnloadEvent = this.options.onUnloadEvent || false;

		var uploadTime = new Date().getTime();
		var data = {
			events: events,
		};
		var scope = this;
		// if (this._sending) data.events = data.events[data.events.length -1];
		if ( this._sending ) {
			data.events = [data.events[data.events.length -1]];
		}

		this._sending = true;

		new Request(url, data, appKey, onUnloadEvent).send(function(status, response) {
			scope._sending = false;
			try {
				if ( status === 204  ) {
					// log('sucessful upload');
					scope.removeEvents(maxEventId, maxIdentifyId);
					scope._unsentEvents = [];
					// Update the event cache after the removal of sent events.
					if (scope.options.saveEvents) {
						scope.saveEvents();
					}

					// Send more events if any queued during previous send.
					if (!scope._sendEventsIfReady(callback) && callback) {
						callback(status, response);
					}

				} else if (status === 413) {
					log('request too large');
					// Can't even get this one massive event through. Drop it.
					if (scope.options.uploadBatchSize === 1) {
						// if massive event is identify, still need to drop it
						scope.removeEvents(maxEventId, maxIdentifyId);
					}

					// The server complained about the length of the request.
					// Backoff and try again.
					scope.options.uploadBatchSize = Math.ceil(numEvents / 2);
					scope.sendEvents(callback);

				} else if (callback) { // If server turns something like a 400
					callback(status, response);
					log('possible 400');
				}
			} catch (e) {
				log( 'failed upload' + e );
			}
		});
	} else if (callback) {
		callback(0, 'No request sent');
	}
};

TongDao.prototype._mergeEventsAndIdentifys = function(numEvents) {
	// coalesce events from both queues
	var eventsToSend = [];
	var eventIndex = 0;
	var maxEventId = -1;
	var identifyIndex = 0;
	var maxIdentifyId = -1;

	while (eventsToSend.length < numEvents) {
		var event;

		// case 1: no identifys - grab from events
		if (identifyIndex >= this._unsentIdentifys.length) {
			event = this._unsentEvents[eventIndex++];
			maxEventId = event.event_id;

		// case 2: no events - grab from identifys
		} else if (eventIndex >= this._unsentEvents.length) {
			event = this._unsentIdentifys[identifyIndex++];
			maxIdentifyId = event.event_id;

		// case 3: need to compare sequence numbers
		} else {
			// events logged before v2.5.0 won't have a sequence number, put those first
			if (!('sequence_number' in this._unsentEvents[eventIndex]) ||
					this._unsentEvents[eventIndex].sequence_number <
					this._unsentIdentifys[identifyIndex].sequence_number) {
				event = this._unsentEvents[eventIndex++];
				maxEventId = event.event_id;
			} else {
				event = this._unsentIdentifys[identifyIndex++];
				maxIdentifyId = event.event_id;
			}
		}

		eventsToSend.push(event);
	}

	return {
		eventsToSend: eventsToSend,
		maxEventId: maxEventId,
		maxIdentifyId: maxIdentifyId
	};
};

/**
 *  @deprecated
 */
TongDao.prototype.setGlobalUserProperties = TongDao.prototype.setUserProperties;

TongDao.prototype.__VERSION__ = version;

TongDao.prototype.redirect = function(redirectUrl){
	window.location.href = redirectUrl + '?UID=' + this.options.cookieId;
};

module.exports = TongDao;

}, {"./cookie":3,"json":4,"./language":5,"./localstorage":6,"JavaScript-MD5":7,"object":8,"./xhr":9,"ua-parser-js":10,"./uuid":11,"./version":12,"./identify":13,"./type":14}],
3: [function(require, module, exports) {
/*
 * Cookie data
 */

var Base64 = require('./base64');
var JSON = require('json'); // jshint ignore:line
var topDomain = require('top-domain');
var md5 = require('JavaScript-MD5');


var _options = {
	expirationDays: undefined,
	domain: undefined
};


var reset = function() {
	_options = {};
};


var options = function(opts) {
	if (arguments.length === 0) {
		return _options;
	}

	opts = opts || {};

	_options.expirationDays = opts.expirationDays;

	var domain = (opts.domain !== undefined) ? opts.domain : '.' + topDomain(window.location.href);
	var token = Math.random();
	_options.domain = domain;
	set('tongdao_test', token);
	var stored = get('tongdao_test');
	if (!stored || stored !== token) {
		domain = null;
	}
	remove('tongdao_test');
	_options.domain = domain;
};

var _domainSpecific = function(name) {
	// differentiate between cookies on different domains
	var suffix = '';
	if (_options.domain) {
		suffix = _options.domain.charAt(0) === '.' ? _options.domain.substring(1) : _options.domain;
	}
	return name + suffix;
};


var get = function(name) {
	try {
		var nameEq = _domainSpecific(name) + '=';
		var ca = document.cookie.split(';');
		var value = null;
		for (var i = 0; i < ca.length; i++) {
			var c = ca[i];
			while (c.charAt(0) === ' ') {
				c = c.substring(1, c.length);
			}
			if (c.indexOf(nameEq) === 0) {
				value = c.substring(nameEq.length, c.length);
				break;
			}
		}

		if (value) {
			return JSON.parse(Base64.decode(value));
		}
		return null;
	} catch (e) {
		return null;
	}
};


var set = function(name, value) {
	try {
		_set(_domainSpecific(name), Base64.encode(JSON.stringify(value)), _options);
		return true;
	} catch (e) {
		return false;
	}
};


var _set = function(name, value, opts) {
	var expires = value !== null ? opts.expirationDays : -1 ;
	if (expires) {
		var date = new Date();
		date.setTime(date.getTime() + (expires * 24 * 60 * 60 * 1000));
		expires = date;
	}
	var str = name + '=' + value;
	if (expires) {
		str += '; expires=' + expires.toUTCString();
	}
	str += '; path=/';
	if (opts.domain) {
		str += '; domain=' + opts.domain;
	}
	document.cookie = str;
};


var remove = function(name) {
	try {
		_set(_domainSpecific(name), null, _options);
		return true;
	} catch (e) {
		return false;
	}
};


module.exports = {
	reset: reset,
	options: options,
	get: get,
	set: set,
	remove: remove

};

}, {"./base64":15,"json":4,"top-domain":16,"JavaScript-MD5":7}],
15: [function(require, module, exports) {
/* jshint bitwise: false */
/* global escape, unescape */

var UTF8 = require('./utf8');

/*
 * Base64 encoder/decoder
 * http://www.webtoolkit.info/
 */
var Base64 = {
		_keyStr: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=',

		encode: function (input) {
				try {
						if (window.btoa && window.atob) {
								return window.btoa(unescape(encodeURIComponent(input)));
						}
				} catch (e) {
						//log(e);
				}
				return Base64._encode(input);
		},

		_encode: function (input) {
				var output = '';
				var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
				var i = 0;

				input = UTF8.encode(input);

				while (i < input.length) {
						chr1 = input.charCodeAt(i++);
						chr2 = input.charCodeAt(i++);
						chr3 = input.charCodeAt(i++);

						enc1 = chr1 >> 2;
						enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
						enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
						enc4 = chr3 & 63;

						if (isNaN(chr2)) {
								enc3 = enc4 = 64;
						} else if (isNaN(chr3)) {
								enc4 = 64;
						}

						output = output +
						Base64._keyStr.charAt(enc1) + Base64._keyStr.charAt(enc2) +
						Base64._keyStr.charAt(enc3) + Base64._keyStr.charAt(enc4);
				}
				return output;
		},

		decode: function (input) {
				try {
						if (window.btoa && window.atob) {
								return decodeURIComponent(escape(window.atob(input)));
						}
				} catch (e) {
						//log(e);
				}
				return Base64._decode(input);
		},

		_decode: function (input) {
				var output = '';
				var chr1, chr2, chr3;
				var enc1, enc2, enc3, enc4;
				var i = 0;

				input = input.replace(/[^A-Za-z0-9\+\/\=]/g, '');

				while (i < input.length) {
						enc1 = Base64._keyStr.indexOf(input.charAt(i++));
						enc2 = Base64._keyStr.indexOf(input.charAt(i++));
						enc3 = Base64._keyStr.indexOf(input.charAt(i++));
						enc4 = Base64._keyStr.indexOf(input.charAt(i++));

						chr1 = (enc1 << 2) | (enc2 >> 4);
						chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
						chr3 = ((enc3 & 3) << 6) | enc4;

						output = output + String.fromCharCode(chr1);

						if (enc3 !== 64) {
								output = output + String.fromCharCode(chr2);
						}
						if (enc4 !== 64) {
								output = output + String.fromCharCode(chr3);
						}
				}
				output = UTF8.decode(output);
				return output;
		}
};

module.exports = Base64;

}, {"./utf8":17}],
17: [function(require, module, exports) {
/* jshint bitwise: false */

/*
 * UTF-8 encoder/decoder
 * http://www.webtoolkit.info/
 */
var UTF8 = {
		encode: function (s) {
				var utftext = '';

				for (var n = 0; n < s.length; n++) {
						var c = s.charCodeAt(n);

						if (c < 128) {
								utftext += String.fromCharCode(c);
						}
						else if((c > 127) && (c < 2048)) {
								utftext += String.fromCharCode((c >> 6) | 192);
								utftext += String.fromCharCode((c & 63) | 128);
						}
						else {
								utftext += String.fromCharCode((c >> 12) | 224);
								utftext += String.fromCharCode(((c >> 6) & 63) | 128);
								utftext += String.fromCharCode((c & 63) | 128);
						}
				}
				return utftext;
		},

		decode: function (utftext) {
				var s = '';
				var i = 0;
				var c = 0, c1 = 0, c2 = 0;

				while ( i < utftext.length ) {
						c = utftext.charCodeAt(i);
						if (c < 128) {
								s += String.fromCharCode(c);
								i++;
						}
						else if((c > 191) && (c < 224)) {
								c1 = utftext.charCodeAt(i+1);
								s += String.fromCharCode(((c & 31) << 6) | (c1 & 63));
								i += 2;
						}
						else {
								c1 = utftext.charCodeAt(i+1);
								c2 = utftext.charCodeAt(i+2);
								s += String.fromCharCode(((c & 15) << 12) | ((c1 & 63) << 6) | (c2 & 63));
								i += 3;
						}
				}
				return s;
		}
};

module.exports = UTF8;

}, {}],
4: [function(require, module, exports) {

var json = window.JSON || {};
var stringify = json.stringify;
var parse = json.parse;

module.exports = parse && stringify
	? JSON
	: require('json-fallback');

}, {"json-fallback":18}],
18: [function(require, module, exports) {
/*
		json2.js
		2014-02-04

		Public Domain.

		NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.

		See http://www.JSON.org/js.html


		This code should be minified before deployment.
		See http://javascript.crockford.com/jsmin.html

		USE YOUR OWN COPY. IT IS EXTREMELY UNWISE TO LOAD CODE FROM SERVERS YOU DO
		NOT CONTROL.


		This file creates a global JSON object containing two methods: stringify
		and parse.

				JSON.stringify(value, replacer, space)
						value       any JavaScript value, usually an object or array.

						replacer    an optional parameter that determines how object
												values are stringified for objects. It can be a
												function or an array of strings.

						space       an optional parameter that specifies the indentation
												of nested structures. If it is omitted, the text will
												be packed without extra whitespace. If it is a number,
												it will specify the number of spaces to indent at each
												level. If it is a string (such as '\t' or '&nbsp;'),
												it contains the characters used to indent at each level.

						This method produces a JSON text from a JavaScript value.

						When an object value is found, if the object contains a toJSON
						method, its toJSON method will be called and the result will be
						stringified. A toJSON method does not serialize: it returns the
						value represented by the name/value pair that should be serialized,
						or undefined if nothing should be serialized. The toJSON method
						will be passed the key associated with the value, and this will be
						bound to the value

						For example, this would serialize Dates as ISO strings.

								Date.prototype.toJSON = function (key) {
										function f(n) {
												// Format integers to have at least two digits.
												return n < 10 ? '0' + n : n;
										}

										return this.getUTCFullYear()   + '-' +
												 f(this.getUTCMonth() + 1) + '-' +
												 f(this.getUTCDate())      + 'T' +
												 f(this.getUTCHours())     + ':' +
												 f(this.getUTCMinutes())   + ':' +
												 f(this.getUTCSeconds())   + 'Z';
								};

						You can provide an optional replacer method. It will be passed the
						key and value of each member, with this bound to the containing
						object. The value that is returned from your method will be
						serialized. If your method returns undefined, then the member will
						be excluded from the serialization.

						If the replacer parameter is an array of strings, then it will be
						used to select the members to be serialized. It filters the results
						such that only members with keys listed in the replacer array are
						stringified.

						Values that do not have JSON representations, such as undefined or
						functions, will not be serialized. Such values in objects will be
						dropped; in arrays they will be replaced with null. You can use
						a replacer function to replace those with JSON values.
						JSON.stringify(undefined) returns undefined.

						The optional space parameter produces a stringification of the
						value that is filled with line breaks and indentation to make it
						easier to read.

						If the space parameter is a non-empty string, then that string will
						be used for indentation. If the space parameter is a number, then
						the indentation will be that many spaces.

						Example:

						text = JSON.stringify(['e', {pluribus: 'unum'}]);
						// text is '["e",{"pluribus":"unum"}]'


						text = JSON.stringify(['e', {pluribus: 'unum'}], null, '\t');
						// text is '[\n\t"e",\n\t{\n\t\t"pluribus": "unum"\n\t}\n]'

						text = JSON.stringify([new Date()], function (key, value) {
								return this[key] instanceof Date ?
										'Date(' + this[key] + ')' : value;
						});
						// text is '["Date(---current time---)"]'


				JSON.parse(text, reviver)
						This method parses a JSON text to produce an object or array.
						It can throw a SyntaxError exception.

						The optional reviver parameter is a function that can filter and
						transform the results. It receives each of the keys and values,
						and its return value is used instead of the original value.
						If it returns what it received, then the structure is not modified.
						If it returns undefined then the member is deleted.

						Example:

						// Parse the text. Values that look like ISO date strings will
						// be converted to Date objects.

						myData = JSON.parse(text, function (key, value) {
								var a;
								if (typeof value === 'string') {
										a =
/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)Z$/.exec(value);
										if (a) {
												return new Date(Date.UTC(+a[1], +a[2] - 1, +a[3], +a[4],
														+a[5], +a[6]));
										}
								}
								return value;
						});

						myData = JSON.parse('["Date(09/09/2001)"]', function (key, value) {
								var d;
								if (typeof value === 'string' &&
												value.slice(0, 5) === 'Date(' &&
												value.slice(-1) === ')') {
										d = new Date(value.slice(5, -1));
										if (d) {
												return d;
										}
								}
								return value;
						});


		This is a reference implementation. You are free to copy, modify, or
		redistribute.
*/

/*jslint evil: true, regexp: true */

/*members "", "\b", "\t", "\n", "\f", "\r", "\"", JSON, "\\", apply,
		call, charCodeAt, getUTCDate, getUTCFullYear, getUTCHours,
		getUTCMinutes, getUTCMonth, getUTCSeconds, hasOwnProperty, join,
		lastIndex, length, parse, prototype, push, replace, slice, stringify,
		test, toJSON, toString, valueOf
*/


// Create a JSON object only if one does not already exist. We create the
// methods in a closure to avoid creating global variables.

(function () {
		'use strict';

		var JSON = module.exports = {};

		function f(n) {
				// Format integers to have at least two digits.
				return n < 10 ? '0' + n : n;
		}

		if (typeof Date.prototype.toJSON !== 'function') {

				Date.prototype.toJSON = function () {

						return isFinite(this.valueOf())
								? this.getUTCFullYear()     + '-' +
										f(this.getUTCMonth() + 1) + '-' +
										f(this.getUTCDate())      + 'T' +
										f(this.getUTCHours())     + ':' +
										f(this.getUTCMinutes())   + ':' +
										f(this.getUTCSeconds())   + 'Z'
								: null;
				};

				String.prototype.toJSON      =
						Number.prototype.toJSON  =
						Boolean.prototype.toJSON = function () {
								return this.valueOf();
						};
		}

		var cx,
				escapable,
				gap,
				indent,
				meta,
				rep;


		function quote(string) {

// If the string contains no control characters, no quote characters, and no
// backslash characters, then we can safely slap some quotes around it.
// Otherwise we must also replace the offending characters with safe escape
// sequences.

				escapable.lastIndex = 0;
				return escapable.test(string) ? '"' + string.replace(escapable, function (a) {
						var c = meta[a];
						return typeof c === 'string'
								? c
								: '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
				}) + '"' : '"' + string + '"';
		}


		function str(key, holder) {

// Produce a string from holder[key].

				var i,          // The loop counter.
						k,          // The member key.
						v,          // The member value.
						length,
						mind = gap,
						partial,
						value = holder[key];

// If the value has a toJSON method, call it to obtain a replacement value.

				if (value && typeof value === 'object' &&
								typeof value.toJSON === 'function') {
						value = value.toJSON(key);
				}

// If we were called with a replacer function, then call the replacer to
// obtain a replacement value.

				if (typeof rep === 'function') {
						value = rep.call(holder, key, value);
				}

// What happens next depends on the value's type.

				switch (typeof value) {
				case 'string':
						return quote(value);

				case 'number':

// JSON numbers must be finite. Encode non-finite numbers as null.

						return isFinite(value) ? String(value) : 'null';

				case 'boolean':
				case 'null':

// If the value is a boolean or null, convert it to a string. Note:
// typeof null does not produce 'null'. The case is included here in
// the remote chance that this gets fixed someday.

						return String(value);

// If the type is 'object', we might be dealing with an object or an array or
// null.

				case 'object':

// Due to a specification blunder in ECMAScript, typeof null is 'object',
// so watch out for that case.

						if (!value) {
								return 'null';
						}

// Make an array to hold the partial results of stringifying this object value.

						gap += indent;
						partial = [];

// Is the value an array?

						if (Object.prototype.toString.apply(value) === '[object Array]') {

// The value is an array. Stringify every element. Use null as a placeholder
// for non-JSON values.

								length = value.length;
								for (i = 0; i < length; i += 1) {
										partial[i] = str(i, value) || 'null';
								}

// Join all of the elements together, separated with commas, and wrap them in
// brackets.

								v = partial.length === 0
										? '[]'
										: gap
										? '[\n' + gap + partial.join(',\n' + gap) + '\n' + mind + ']'
										: '[' + partial.join(',') + ']';
								gap = mind;
								return v;
						}

// If the replacer is an array, use it to select the members to be stringified.

						if (rep && typeof rep === 'object') {
								length = rep.length;
								for (i = 0; i < length; i += 1) {
										if (typeof rep[i] === 'string') {
												k = rep[i];
												v = str(k, value);
												if (v) {
														partial.push(quote(k) + (gap ? ': ' : ':') + v);
												}
										}
								}
						} else {

// Otherwise, iterate through all of the keys in the object.

								for (k in value) {
										if (Object.prototype.hasOwnProperty.call(value, k)) {
												v = str(k, value);
												if (v) {
														partial.push(quote(k) + (gap ? ': ' : ':') + v);
												}
										}
								}
						}

// Join all of the member texts together, separated with commas,
// and wrap them in braces.

						v = partial.length === 0
								? '{}'
								: gap
								? '{\n' + gap + partial.join(',\n' + gap) + '\n' + mind + '}'
								: '{' + partial.join(',') + '}';
						gap = mind;
						return v;
				}
		}

// If the JSON object does not yet have a stringify method, give it one.

		if (typeof JSON.stringify !== 'function') {
				escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
				meta = {    // table of character substitutions
						'\b': '\\b',
						'\t': '\\t',
						'\n': '\\n',
						'\f': '\\f',
						'\r': '\\r',
						'"' : '\\"',
						'\\': '\\\\'
				};
				JSON.stringify = function (value, replacer, space) {

// The stringify method takes a value and an optional replacer, and an optional
// space parameter, and returns a JSON text. The replacer can be a function
// that can replace values, or an array of strings that will select the keys.
// A default replacer method can be provided. Use of the space parameter can
// produce text that is more easily readable.

						var i;
						gap = '';
						indent = '';

// If the space parameter is a number, make an indent string containing that
// many spaces.

						if (typeof space === 'number') {
								for (i = 0; i < space; i += 1) {
										indent += ' ';
								}

// If the space parameter is a string, it will be used as the indent string.

						} else if (typeof space === 'string') {
								indent = space;
						}

// If there is a replacer, it must be a function or an array.
// Otherwise, throw an error.

						rep = replacer;
						if (replacer && typeof replacer !== 'function' &&
										(typeof replacer !== 'object' ||
										typeof replacer.length !== 'number')) {
								throw new Error('JSON.stringify');
						}

// Make a fake root object containing our value under the key of ''.
// Return the result of stringifying the value.

						return str('', {'': value});
				};
		}


// If the JSON object does not yet have a parse method, give it one.

		if (typeof JSON.parse !== 'function') {
				cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
				JSON.parse = function (text, reviver) {

// The parse method takes a text and an optional reviver function, and returns
// a JavaScript value if the text is a valid JSON text.

						var j;

						function walk(holder, key) {

// The walk method is used to recursively walk the resulting structure so
// that modifications can be made.

								var k, v, value = holder[key];
								if (value && typeof value === 'object') {
										for (k in value) {
												if (Object.prototype.hasOwnProperty.call(value, k)) {
														v = walk(value, k);
														if (v !== undefined) {
																value[k] = v;
														} else {
																delete value[k];
														}
												}
										}
								}
								return reviver.call(holder, key, value);
						}


// Parsing happens in four stages. In the first stage, we replace certain
// Unicode characters with escape sequences. JavaScript handles many characters
// incorrectly, either silently deleting them, or treating them as line endings.

						text = String(text);
						cx.lastIndex = 0;
						if (cx.test(text)) {
								text = text.replace(cx, function (a) {
										return '\\u' +
												('0000' + a.charCodeAt(0).toString(16)).slice(-4);
								});
						}

// In the second stage, we run the text against regular expressions that look
// for non-JSON patterns. We are especially concerned with '()' and 'new'
// because they can cause invocation, and '=' because it can cause mutation.
// But just to be safe, we want to reject all unexpected forms.

// We split the second stage into 4 regexp operations in order to work around
// crippling inefficiencies in IE's and Safari's regexp engines. First we
// replace the JSON backslash pairs with '@' (a non-JSON character). Second, we
// replace all simple value tokens with ']' characters. Third, we delete all
// open brackets that follow a colon or comma or that begin the text. Finally,
// we look to see that the remaining characters are only whitespace or ']' or
// ',' or ':' or '{' or '}'. If that is so, then the text is safe for eval.

						if (/^[\],:{}\s]*$/
										.test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@')
												.replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']')
												.replace(/(?:^|:|,)(?:\s*\[)+/g, ''))) {

// In the third stage we use the eval function to compile the text into a
// JavaScript structure. The '{' operator is subject to a syntactic ambiguity
// in JavaScript: it can begin a block or an object literal. We wrap the text
// in parens to eliminate the ambiguity.

								j = eval('(' + text + ')');

// In the optional fourth stage, we recursively walk the new structure, passing
// each name/value pair to a reviver function for possible transformation.

								return typeof reviver === 'function'
										? walk({'': j}, '')
										: j;
						}

// If the text is not JSON parseable, then a SyntaxError is thrown.

						throw new SyntaxError('JSON.parse');
				};
		}
}());

}, {}],
16: [function(require, module, exports) {

/**
 * Module dependencies.
 */

var parse = require('url').parse;

/**
 * Expose `domain`
 */

module.exports = domain;

/**
 * RegExp
 */

var regexp = /[a-z0-9][a-z0-9\-]*[a-z0-9]\.[a-z\.]{2,6}$/i;

/**
 * Get the top domain.
 * 
 * Official Grammar: http://tools.ietf.org/html/rfc883#page-56
 * Look for tlds with up to 2-6 characters.
 * 
 * Example:
 * 
 *      domain('http://localhost:3000/baz');
 *      // => ''
 *      domain('http://dev:3000/baz');
 *      // => ''
 *      domain('http://127.0.0.1:3000/baz');
 *      // => ''
 *      domain('http://segment.io/baz');
 *      // => 'segment.io'
 * 
 * @param {String} url
 * @return {String}
 * @api public
 */

function domain(url){
	var host = parse(url).hostname;
	var match = host.match(regexp);
	return match ? match[0] : '';
};

}, {"url":19}],
19: [function(require, module, exports) {

/**
 * Parse the given `url`.
 *
 * @param {String} str
 * @return {Object}
 * @api public
 */

exports.parse = function(url){
	var a = document.createElement('a');
	a.href = url;
	return {
		href: a.href,
		host: a.host || location.host,
		port: ('0' === a.port || '' === a.port) ? port(a.protocol) : a.port,
		hash: a.hash,
		hostname: a.hostname || location.hostname,
		pathname: a.pathname.charAt(0) != '/' ? '/' + a.pathname : a.pathname,
		protocol: !a.protocol || ':' == a.protocol ? location.protocol : a.protocol,
		search: a.search,
		query: a.search.slice(1)
	};
};

/**
 * Check if `url` is absolute.
 *
 * @param {String} url
 * @return {Boolean}
 * @api public
 */

exports.isAbsolute = function(url){
	return 0 == url.indexOf('//') || !!~url.indexOf('://');
};

/**
 * Check if `url` is relative.
 *
 * @param {String} url
 * @return {Boolean}
 * @api public
 */

exports.isRelative = function(url){
	return !exports.isAbsolute(url);
};

/**
 * Check if `url` is cross domain.
 *
 * @param {String} url
 * @return {Boolean}
 * @api public
 */

exports.isCrossDomain = function(url){
	url = exports.parse(url);
	var location = exports.parse(window.location.href);
	return url.hostname !== location.hostname
		|| url.port !== location.port
		|| url.protocol !== location.protocol;
};

/**
 * Return default port for `protocol`.
 *
 * @param  {String} protocol
 * @return {String}
 * @api private
 */
function port (protocol){
	switch (protocol) {
		case 'http:':
			return 80;
		case 'https:':
			return 443;
		default:
			return location.port;
	}
}

}, {}],
5: [function(require, module, exports) {
var getLanguage = function() {
		return (navigator && ((navigator.languages && navigator.languages[0]) ||
				navigator.language || navigator.userLanguage)) || undefined;
};

module.exports = {
		language: getLanguage()
};

}, {}],
6: [function(require, module, exports) {
/* jshint -W020, unused: false, noempty: false, boss: true */

/*
 * Implement localStorage to support Firefox 2-3 and IE 5-7
 */
var localStorage; // jshint ignore:line

// test that Window.localStorage is available and works
function windowLocalStorageAvailable() {
	var uid = new Date();
	var result;
	try {
		window.localStorage.setItem(uid, uid);
		result = window.localStorage.getItem(uid) === String(uid);
		window.localStorage.removeItem(uid);
		return result;
	} catch (e) {
		// localStorage not available
	}
	return false;
}

if (windowLocalStorageAvailable()) {
	localStorage = window.localStorage;
} else if (window.globalStorage) {
	// Firefox 2-3 use globalStorage
	// See https://developer.mozilla.org/en/dom/storage#globalStorage
	try {
		localStorage = window.globalStorage[window.location.hostname];
	} catch (e) {
		// Something bad happened...
	}
} else {
	// IE 5-7 use userData
	// See http://msdn.microsoft.com/en-us/library/ms531424(v=vs.85).aspx
	var div = document.createElement('div'),
			attrKey = 'localStorage';
	div.style.display = 'none';
	document.getElementsByTagName('head')[0].appendChild(div);
	if (div.addBehavior) {
		div.addBehavior('#default#userdata');
		localStorage = {
			length: 0,
			setItem: function(k, v) {
				div.load(attrKey);
				if (!div.getAttribute(k)) {
					this.length++;
				}
				div.setAttribute(k, v);
				div.save(attrKey);
			},
			getItem: function(k) {
				div.load(attrKey);
				return div.getAttribute(k);
			},
			removeItem: function(k) {
				div.load(attrKey);
				if (div.getAttribute(k)) {
					this.length--;
				}
				div.removeAttribute(k);
				div.save(attrKey);
			},
			clear: function() {
				div.load(attrKey);
				var i = 0;
				var attr;
				while (attr = div.XMLDocument.documentElement.attributes[i++]) {
					div.removeAttribute(attr.name);
				}
				div.save(attrKey);
				this.length = 0;
			},
			key: function(k) {
				div.load(attrKey);
				return div.XMLDocument.documentElement.attributes[k];
			}
		};
		div.load(attrKey);
		localStorage.length = div.XMLDocument.documentElement.attributes.length;
	} else {
		/* Nothing we can do ... */
	}
}
if (!localStorage) {
	localStorage = {
		length: 0,
		setItem: function(k, v) {
		},
		getItem: function(k) {
		},
		removeItem: function(k) {
		},
		clear: function() {
		},
		key: function(k) {
		}
	};
}

module.exports = localStorage;

}, {}],
7: [function(require, module, exports) {
/*
 * JavaScript MD5 1.0.1
 * https://github.com/blueimp/JavaScript-MD5
 *
 * Copyright 2011, Sebastian Tschan
 * https://blueimp.net
 *
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/MIT
 * 
 * Based on
 * A JavaScript implementation of the RSA Data Security, Inc. MD5 Message
 * Digest Algorithm, as defined in RFC 1321.
 * Version 2.2 Copyright (C) Paul Johnston 1999 - 2009
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for more info.
 */

/*jslint bitwise: true */
/*global unescape, define */

(function ($) {
		'use strict';

		/*
		* Add integers, wrapping at 2^32. This uses 16-bit operations internally
		* to work around bugs in some JS interpreters.
		*/
		function safe_add(x, y) {
				var lsw = (x & 0xFFFF) + (y & 0xFFFF),
						msw = (x >> 16) + (y >> 16) + (lsw >> 16);
				return (msw << 16) | (lsw & 0xFFFF);
		}

		/*
		* Bitwise rotate a 32-bit number to the left.
		*/
		function bit_rol(num, cnt) {
				return (num << cnt) | (num >>> (32 - cnt));
		}

		/*
		* These functions implement the four basic operations the algorithm uses.
		*/
		function md5_cmn(q, a, b, x, s, t) {
				return safe_add(bit_rol(safe_add(safe_add(a, q), safe_add(x, t)), s), b);
		}
		function md5_ff(a, b, c, d, x, s, t) {
				return md5_cmn((b & c) | ((~b) & d), a, b, x, s, t);
		}
		function md5_gg(a, b, c, d, x, s, t) {
				return md5_cmn((b & d) | (c & (~d)), a, b, x, s, t);
		}
		function md5_hh(a, b, c, d, x, s, t) {
				return md5_cmn(b ^ c ^ d, a, b, x, s, t);
		}
		function md5_ii(a, b, c, d, x, s, t) {
				return md5_cmn(c ^ (b | (~d)), a, b, x, s, t);
		}

		/*
		* Calculate the MD5 of an array of little-endian words, and a bit length.
		*/
		function binl_md5(x, len) {
				/* append padding */
				x[len >> 5] |= 0x80 << (len % 32);
				x[(((len + 64) >>> 9) << 4) + 14] = len;

				var i, olda, oldb, oldc, oldd,
						a =  1732584193,
						b = -271733879,
						c = -1732584194,
						d =  271733878;

				for (i = 0; i < x.length; i += 16) {
						olda = a;
						oldb = b;
						oldc = c;
						oldd = d;

						a = md5_ff(a, b, c, d, x[i],       7, -680876936);
						d = md5_ff(d, a, b, c, x[i +  1], 12, -389564586);
						c = md5_ff(c, d, a, b, x[i +  2], 17,  606105819);
						b = md5_ff(b, c, d, a, x[i +  3], 22, -1044525330);
						a = md5_ff(a, b, c, d, x[i +  4],  7, -176418897);
						d = md5_ff(d, a, b, c, x[i +  5], 12,  1200080426);
						c = md5_ff(c, d, a, b, x[i +  6], 17, -1473231341);
						b = md5_ff(b, c, d, a, x[i +  7], 22, -45705983);
						a = md5_ff(a, b, c, d, x[i +  8],  7,  1770035416);
						d = md5_ff(d, a, b, c, x[i +  9], 12, -1958414417);
						c = md5_ff(c, d, a, b, x[i + 10], 17, -42063);
						b = md5_ff(b, c, d, a, x[i + 11], 22, -1990404162);
						a = md5_ff(a, b, c, d, x[i + 12],  7,  1804603682);
						d = md5_ff(d, a, b, c, x[i + 13], 12, -40341101);
						c = md5_ff(c, d, a, b, x[i + 14], 17, -1502002290);
						b = md5_ff(b, c, d, a, x[i + 15], 22,  1236535329);

						a = md5_gg(a, b, c, d, x[i +  1],  5, -165796510);
						d = md5_gg(d, a, b, c, x[i +  6],  9, -1069501632);
						c = md5_gg(c, d, a, b, x[i + 11], 14,  643717713);
						b = md5_gg(b, c, d, a, x[i],      20, -373897302);
						a = md5_gg(a, b, c, d, x[i +  5],  5, -701558691);
						d = md5_gg(d, a, b, c, x[i + 10],  9,  38016083);
						c = md5_gg(c, d, a, b, x[i + 15], 14, -660478335);
						b = md5_gg(b, c, d, a, x[i +  4], 20, -405537848);
						a = md5_gg(a, b, c, d, x[i +  9],  5,  568446438);
						d = md5_gg(d, a, b, c, x[i + 14],  9, -1019803690);
						c = md5_gg(c, d, a, b, x[i +  3], 14, -187363961);
						b = md5_gg(b, c, d, a, x[i +  8], 20,  1163531501);
						a = md5_gg(a, b, c, d, x[i + 13],  5, -1444681467);
						d = md5_gg(d, a, b, c, x[i +  2],  9, -51403784);
						c = md5_gg(c, d, a, b, x[i +  7], 14,  1735328473);
						b = md5_gg(b, c, d, a, x[i + 12], 20, -1926607734);

						a = md5_hh(a, b, c, d, x[i +  5],  4, -378558);
						d = md5_hh(d, a, b, c, x[i +  8], 11, -2022574463);
						c = md5_hh(c, d, a, b, x[i + 11], 16,  1839030562);
						b = md5_hh(b, c, d, a, x[i + 14], 23, -35309556);
						a = md5_hh(a, b, c, d, x[i +  1],  4, -1530992060);
						d = md5_hh(d, a, b, c, x[i +  4], 11,  1272893353);
						c = md5_hh(c, d, a, b, x[i +  7], 16, -155497632);
						b = md5_hh(b, c, d, a, x[i + 10], 23, -1094730640);
						a = md5_hh(a, b, c, d, x[i + 13],  4,  681279174);
						d = md5_hh(d, a, b, c, x[i],      11, -358537222);
						c = md5_hh(c, d, a, b, x[i +  3], 16, -722521979);
						b = md5_hh(b, c, d, a, x[i +  6], 23,  76029189);
						a = md5_hh(a, b, c, d, x[i +  9],  4, -640364487);
						d = md5_hh(d, a, b, c, x[i + 12], 11, -421815835);
						c = md5_hh(c, d, a, b, x[i + 15], 16,  530742520);
						b = md5_hh(b, c, d, a, x[i +  2], 23, -995338651);

						a = md5_ii(a, b, c, d, x[i],       6, -198630844);
						d = md5_ii(d, a, b, c, x[i +  7], 10,  1126891415);
						c = md5_ii(c, d, a, b, x[i + 14], 15, -1416354905);
						b = md5_ii(b, c, d, a, x[i +  5], 21, -57434055);
						a = md5_ii(a, b, c, d, x[i + 12],  6,  1700485571);
						d = md5_ii(d, a, b, c, x[i +  3], 10, -1894986606);
						c = md5_ii(c, d, a, b, x[i + 10], 15, -1051523);
						b = md5_ii(b, c, d, a, x[i +  1], 21, -2054922799);
						a = md5_ii(a, b, c, d, x[i +  8],  6,  1873313359);
						d = md5_ii(d, a, b, c, x[i + 15], 10, -30611744);
						c = md5_ii(c, d, a, b, x[i +  6], 15, -1560198380);
						b = md5_ii(b, c, d, a, x[i + 13], 21,  1309151649);
						a = md5_ii(a, b, c, d, x[i +  4],  6, -145523070);
						d = md5_ii(d, a, b, c, x[i + 11], 10, -1120210379);
						c = md5_ii(c, d, a, b, x[i +  2], 15,  718787259);
						b = md5_ii(b, c, d, a, x[i +  9], 21, -343485551);

						a = safe_add(a, olda);
						b = safe_add(b, oldb);
						c = safe_add(c, oldc);
						d = safe_add(d, oldd);
				}
				return [a, b, c, d];
		}

		/*
		* Convert an array of little-endian words to a string
		*/
		function binl2rstr(input) {
				var i,
						output = '';
				for (i = 0; i < input.length * 32; i += 8) {
						output += String.fromCharCode((input[i >> 5] >>> (i % 32)) & 0xFF);
				}
				return output;
		}

		/*
		* Convert a raw string to an array of little-endian words
		* Characters >255 have their high-byte silently ignored.
		*/
		function rstr2binl(input) {
				var i,
						output = [];
				output[(input.length >> 2) - 1] = undefined;
				for (i = 0; i < output.length; i += 1) {
						output[i] = 0;
				}
				for (i = 0; i < input.length * 8; i += 8) {
						output[i >> 5] |= (input.charCodeAt(i / 8) & 0xFF) << (i % 32);
				}
				return output;
		}

		/*
		* Calculate the MD5 of a raw string
		*/
		function rstr_md5(s) {
				return binl2rstr(binl_md5(rstr2binl(s), s.length * 8));
		}

		/*
		* Calculate the HMAC-MD5, of a key and some data (raw strings)
		*/
		function rstr_hmac_md5(key, data) {
				var i,
						bkey = rstr2binl(key),
						ipad = [],
						opad = [],
						hash;
				ipad[15] = opad[15] = undefined;
				if (bkey.length > 16) {
						bkey = binl_md5(bkey, key.length * 8);
				}
				for (i = 0; i < 16; i += 1) {
						ipad[i] = bkey[i] ^ 0x36363636;
						opad[i] = bkey[i] ^ 0x5C5C5C5C;
				}
				hash = binl_md5(ipad.concat(rstr2binl(data)), 512 + data.length * 8);
				return binl2rstr(binl_md5(opad.concat(hash), 512 + 128));
		}

		/*
		* Convert a raw string to a hex string
		*/
		function rstr2hex(input) {
				var hex_tab = '0123456789abcdef',
						output = '',
						x,
						i;
				for (i = 0; i < input.length; i += 1) {
						x = input.charCodeAt(i);
						output += hex_tab.charAt((x >>> 4) & 0x0F) +
								hex_tab.charAt(x & 0x0F);
				}
				return output;
		}

		/*
		* Encode a string as utf-8
		*/
		function str2rstr_utf8(input) {
				return unescape(encodeURIComponent(input));
		}

		/*
		* Take string arguments and return either raw or hex encoded strings
		*/
		function raw_md5(s) {
				return rstr_md5(str2rstr_utf8(s));
		}
		function hex_md5(s) {
				return rstr2hex(raw_md5(s));
		}
		function raw_hmac_md5(k, d) {
				return rstr_hmac_md5(str2rstr_utf8(k), str2rstr_utf8(d));
		}
		function hex_hmac_md5(k, d) {
				return rstr2hex(raw_hmac_md5(k, d));
		}

		function md5(string, key, raw) {
				if (!key) {
						if (!raw) {
								return hex_md5(string);
						}
						return raw_md5(string);
				}
				if (!raw) {
						return hex_hmac_md5(key, string);
				}
				return raw_hmac_md5(key, string);
		}

		// check js environment
		if (typeof(exports) !== 'undefined') {
				// nodejs env
				if (typeof module !== 'undefined' && module.exports) {
						exports = module.exports = md5;
				}
				exports.md5 = md5;
		} else {
				// requirejs env (optional)
				if (typeof(define) === 'function' && define.amd) {
						define(function () {
										return md5;
								});
				} else {
						// browser env
						$.md5 = md5;
				}
		}
}(this));

}, {}],
8: [function(require, module, exports) {

/**
 * HOP ref.
 */

var has = Object.prototype.hasOwnProperty;

/**
 * Return own keys in `obj`.
 *
 * @param {Object} obj
 * @return {Array}
 * @api public
 */

exports.keys = Object.keys || function(obj){
	var keys = [];
	for (var key in obj) {
		if (has.call(obj, key)) {
			keys.push(key);
		}
	}
	return keys;
};

/**
 * Return own values in `obj`.
 *
 * @param {Object} obj
 * @return {Array}
 * @api public
 */

exports.values = function(obj){
	var vals = [];
	for (var key in obj) {
		if (has.call(obj, key)) {
			vals.push(obj[key]);
		}
	}
	return vals;
};

/**
 * Merge `b` into `a`.
 *
 * @param {Object} a
 * @param {Object} b
 * @return {Object} a
 * @api public
 */

exports.merge = function(a, b){
	for (var key in b) {
		if (has.call(b, key)) {
			a[key] = b[key];
		}
	}
	return a;
};

/**
 * Return length of `obj`.
 *
 * @param {Object} obj
 * @return {Number}
 * @api public
 */

exports.length = function(obj){
	return exports.keys(obj).length;
};

/**
 * Check if `obj` is empty.
 *
 * @param {Object} obj
 * @return {Boolean}
 * @api public
 */

exports.isEmpty = function(obj){
	return 0 == exports.length(obj);
};
}, {}],
9: [function(require, module, exports) {
var querystring = require('querystring');

/*
 * Simple AJAX request object
 */
var Request = function(url, data, appKey, onUnloadEvent) {
	this.url = url;
	this.data = data || {};
	this.appKey = appKey;
	this.onUnloadEvent = onUnloadEvent;
};

Request.prototype.send = function(callback) {
	var isIE = window.XDomainRequest ? true : false;
	if (isIE) {
		var xdr = new window.XDomainRequest();
		xdr.open('POST', this.url, (this.onUnloadEvent) ? false : true );
		xdr.onload = function() {
			// callback(200, xdr.responseText);
		};
		xdr.onerror = function () {
			// status code not available from xdr, try string matching on responseText
			if (xdr.responseText === 'Request Entity Too Large') {
				callback(413, xdr.responseText);
			} else {
				callback(500, xdr.responseText);
			}
		};
		xdr.ontimeout = function () {};
		xdr.onprogress = function() {};
		xdr.send( JSON.stringify(this.data) );
	} else {
		var xhr = new XMLHttpRequest();
		xhr.open('POST', this.url, true );
		xhr.onreadystatechange = function() {
			if (xhr.readyState === 4) {
				if (xhrTimeout) clearTimeout(xhrTimeout);
				callback(xhr.status, xhr.responseText);
			}
		};
		xhr.setRequestHeader('X-APP-KEY', this.appKey );
		xhr.setRequestHeader('Content-Type', 'application/json');
		xhr.setRequestHeader('Accept', 'application/json');
		// xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
		xhr.send( JSON.stringify(this.data) );

		// FOR UNLOAD EVENTS SET 2 SECOND TIMEOUT TO AVOID BROWSER FREEZE
		if ( this.onUnloadEvent ) {
			var xhrTimeout = setTimeout(requestTimeout, 1000);
			function requestTimeout(){
				xhr.abort();
			};
		}
	}
	// console.log('sent request to ' + this.url + ' with data ' + decodeURIComponent(queryString(this.data)));
};

module.exports = Request;

}, {"querystring":20}],
20: [function(require, module, exports) {

/**
 * Module dependencies.
 */

var encode = encodeURIComponent;
var decode = decodeURIComponent;
var trim = require('trim');
var type = require('type');

/**
 * Parse the given query `str`.
 *
 * @param {String} str
 * @return {Object}
 * @api public
 */

exports.parse = function(str){
	if ('string' != typeof str) return {};

	str = trim(str);
	if ('' == str) return {};
	if ('?' == str.charAt(0)) str = str.slice(1);

	var obj = {};
	var pairs = str.split('&');
	for (var i = 0; i < pairs.length; i++) {
		var parts = pairs[i].split('=');
		var key = decode(parts[0]);
		var m;

		if (m = /(\w+)\[(\d+)\]/.exec(key)) {
			obj[m[1]] = obj[m[1]] || [];
			obj[m[1]][m[2]] = decode(parts[1]);
			continue;
		}

		obj[parts[0]] = null == parts[1]
			? ''
			: decode(parts[1]);
	}

	return obj;
};

/**
 * Stringify the given `obj`.
 *
 * @param {Object} obj
 * @return {String}
 * @api public
 */

exports.stringify = function(obj){
	if (!obj) return '';
	var pairs = [];

	for (var key in obj) {
		var value = obj[key];

		if ('array' == type(value)) {
			for (var i = 0; i < value.length; ++i) {
				pairs.push(encode(key + '[' + i + ']') + '=' + encode(value[i]));
			}
			continue;
		}

		pairs.push(encode(key) + '=' + encode(obj[key]));
	}

	return pairs.join('&');
};

}, {"trim":21,"type":22}],
21: [function(require, module, exports) {

exports = module.exports = trim;

function trim(str){
	if (str.trim) return str.trim();
	return str.replace(/^\s*|\s*$/g, '');
}

exports.left = function(str){
	if (str.trimLeft) return str.trimLeft();
	return str.replace(/^\s*/, '');
};

exports.right = function(str){
	if (str.trimRight) return str.trimRight();
	return str.replace(/\s*$/, '');
};

}, {}],
22: [function(require, module, exports) {
/**
 * toString ref.
 */

var toString = Object.prototype.toString;

/**
 * Return the type of `val`.
 *
 * @param {Mixed} val
 * @return {String}
 * @api public
 */

module.exports = function(val){
	switch (toString.call(val)) {
		case '[object Date]': return 'date';
		case '[object RegExp]': return 'regexp';
		case '[object Arguments]': return 'arguments';
		case '[object Array]': return 'array';
		case '[object Error]': return 'error';
	}

	if (val === null) return 'null';
	if (val === undefined) return 'undefined';
	if (val !== val) return 'nan';
	if (val && val.nodeType === 1) return 'element';

	if (typeof Buffer != 'undefined' && Buffer.isBuffer(val)) return 'buffer';

	val = val.valueOf
		? val.valueOf()
		: Object.prototype.valueOf.apply(val)

	return typeof val;
};

}, {}],
10: [function(require, module, exports) {
/* jshint eqeqeq: false, forin: false */
/* global define */

/**
 * UAParser.js v0.7.7
 * Lightweight JavaScript-based User-Agent string parser
 * https://github.com/faisalman/ua-parser-js
 *
 * Copyright © 2012-2015 Faisal Salman <fyzlman@gmail.com>
 * Dual licensed under GPLv2 & MIT
 */

(function (window, undefined) {

		'use strict';

		//////////////
		// Constants
		/////////////


		var LIBVERSION  = '0.7.7',
				EMPTY       = '',
				UNKNOWN     = '?',
				FUNC_TYPE   = 'function',
				UNDEF_TYPE  = 'undefined',
				OBJ_TYPE    = 'object',
				STR_TYPE    = 'string',
				MAJOR       = 'major', // deprecated
				MODEL       = 'model',
				NAME        = 'name',
				TYPE        = 'type',
				VENDOR      = 'vendor',
				VERSION     = 'version',
				ARCHITECTURE= 'architecture',
				CONSOLE     = 'console',
				MOBILE      = 'mobile',
				TABLET      = 'tablet',
				SMARTTV     = 'smarttv',
				WEARABLE    = 'wearable',
				EMBEDDED    = 'embedded';


		///////////
		// Helper
		//////////


		var util = {
				extend : function (regexes, extensions) {
						for (var i in extensions) {
								if ("browser cpu device engine os".indexOf(i) !== -1 && extensions[i].length % 2 === 0) {
										regexes[i] = extensions[i].concat(regexes[i]);
								}
						}
						return regexes;
				},
				has : function (str1, str2) {
					if (typeof str1 === "string") {
						return str2.toLowerCase().indexOf(str1.toLowerCase()) !== -1;
					} else {
						return false;
					}
				},
				lowerize : function (str) {
						return str.toLowerCase();
				},
				major : function (version) {
						return typeof(version) === STR_TYPE ? version.split(".")[0] : undefined;
				}
		};


		///////////////
		// Map helper
		//////////////


		var mapper = {

			rgx : function () {

				var result, i = 0, j, k, p, q, matches, match, args = arguments;

				// loop through all regexes maps
				while (i < args.length && !matches) {

					var regex = args[i],       // even sequence (0,2,4,..)
						props = args[i + 1];   // odd sequence (1,3,5,..)

					// construct object barebones
					if (typeof result === UNDEF_TYPE) {
						result = {};
						for (p in props) {
							q = props[p];
							if (typeof q === OBJ_TYPE) {
								result[q[0]] = undefined;
							} else {
								result[q] = undefined;
							}
						}
					}

					// try matching uastring with regexes
					j = k = 0;
					while (j < regex.length && !matches) {
						matches = regex[j++].exec(this.getUA());
						if (!!matches) {
							for (p = 0; p < props.length; p++) {
								match = matches[++k];
								q = props[p];
								// check if given property is actually array
								if (typeof q === OBJ_TYPE && q.length > 0) {
									if (q.length == 2) {
										if (typeof q[1] == FUNC_TYPE) {
											// assign modified match
											result[q[0]] = q[1].call(this, match);
										} else {
											// assign given value, ignore regex match
											result[q[0]] = q[1];
										}
									} else if (q.length == 3) {
										// check whether function or regex
										if (typeof q[1] === FUNC_TYPE && !(q[1].exec && q[1].test)) {
											// call function (usually string mapper)
											result[q[0]] = match ? q[1].call(this, match, q[2]) : undefined;
										} else {
											// sanitize match using given regex
											result[q[0]] = match ? match.replace(q[1], q[2]) : undefined;
										}
									} else if (q.length == 4) {
										result[q[0]] = match ? q[3].call(this, match.replace(q[1], q[2])) : undefined;
									}
								} else {
									result[q] = match ? match : undefined;
								}
							}
						}
					}
					i += 2;
				}
				return result;
			},

				str : function (str, map) {

						for (var i in map) {
								// check if array
								if (typeof map[i] === OBJ_TYPE && map[i].length > 0) {
										for (var j = 0; j < map[i].length; j++) {
												if (util.has(map[i][j], str)) {
														return (i === UNKNOWN) ? undefined : i;
												}
										}
								} else if (util.has(map[i], str)) {
										return (i === UNKNOWN) ? undefined : i;
								}
						}
						return str;
				}
		};


		///////////////
		// String map
		//////////////


		var maps = {

				browser : {
						oldsafari : {
								version : {
										'1.0'   : '/8',
										'1.2'   : '/1',
										'1.3'   : '/3',
										'2.0'   : '/412',
										'2.0.2' : '/416',
										'2.0.3' : '/417',
										'2.0.4' : '/419',
										'?'     : '/'
								}
						},
						name : {
								'Opera Mobile' : 'Opera Mobi',
								'IE Mobile'    : 'IEMobile'
						}
				},

				device : {
						amazon : {
								model : {
										'Fire Phone' : ['SD', 'KF']
								}
						},
						sprint : {
								model : {
										'Evo Shift 4G' : '7373KT'
								},
								vendor : {
										'HTC'       : 'APA',
										'Sprint'    : 'Sprint'
								}
						}
				},

				os : {
						windows : {
								version : {
										'ME'        : '4.90',
										'NT 3.11'   : 'NT3.51',
										'NT 4.0'    : 'NT4.0',
										'2000'      : 'NT 5.0',
										'XP'        : ['NT 5.1', 'NT 5.2'],
										'Vista'     : 'NT 6.0',
										'7'         : 'NT 6.1',
										'8'         : 'NT 6.2',
										'8.1'       : 'NT 6.3',
										'10'        : ['NT 6.4', 'NT 10.0'],
										'RT'        : 'ARM'
								},
								name : {
										'Windows Phone' : 'Windows Phone OS',
								}
						}
				}
		};


		//////////////
		// Regex map
		/////////////


		var regexes = {

				browser : [[

						// Presto based
						/(opera\smini)\/([\w\.-]+)/i,                                       // Opera Mini
						/(opera\s[mobiletab]+).+version\/([\w\.-]+)/i,                      // Opera Mobi/Tablet
						/(opera).+version\/([\w\.]+)/i,                                     // Opera > 9.80
						/(opera)[\/\s]+([\w\.]+)/i                                          // Opera < 9.80

						], [[NAME, mapper.str, maps.browser.name], VERSION], [

						/\s(opr)\/([\w\.]+)/i                                               // Opera Webkit
						], [[NAME, 'Opera'], VERSION], [

						// Mixed
						/(kindle)\/([\w\.]+)/i,                                             // Kindle
						/(lunascape|maxthon|netfront|jasmine|blazer)[\/\s]?([\w\.]+)*/i,
						// Trident based
						/(avant\s|iemobile|slim|baidu)(?:browser)?[\/\s]?([\w\.]*)/i,
						/(?:ms|\()(ie)\s([\w\.]+)/i,                                        // Internet Explorer

						// Webkit/KHTML based
						/(rekonq)\/([\w\.]+)*/i,                                            // Rekonq
						/(chromium|flock|rockmelt|midori|epiphany|silk|skyfire|ovibrowser|bolt|iron|vivaldi)\/([\w\.-]+)/i
						], [[NAME, mapper.str, maps.browser.name], VERSION], [

						/(trident).+rv[:\s]([\w\.]+).+like\sgecko/i,                        // IE11
						/(Edge)\/((\d+)?[\w\.]+)/i                                          // IE12
						], [[NAME, 'IE'], VERSION], [

						/(yabrowser)\/([\w\.]+)/i                                           // Yandex
						], [[NAME, 'Yandex'], VERSION], [

						/(comodo_dragon)\/([\w\.]+)/i                                       // Comodo Dragon
						], [[NAME, /_/g, ' '], VERSION], [

						/((?:android.+)crmo|crios)\/([\w\.]+)/i,
						/android.+chrome\/([\w\.]+)\s+(?:mobile\s?safari)/i                 // Chrome for Android/iOS
						], [[NAME, 'Chrome Mobile'], VERSION], [

						/(chrome|omniweb|arora|[tizenoka]{5}\s?browser)\/v?([\w\.]+)/i,
						/(uc\s?browser|qqbrowser)[\/\s]?([\w\.]+)/i
						], [NAME, VERSION], [

						/(dolfin)\/([\w\.]+)/i                                              // Dolphin
						], [[NAME, 'Dolphin'], VERSION], [

						/XiaoMi\/MiuiBrowser\/([\w\.]+)/i                                   // MIUI Browser
						], [VERSION, [NAME, 'MIUI Browser']], [

						/android.+version\/([\w\.]+)\s+(?:mobile\s?safari|safari)/i         // Android Browser
						], [VERSION, [NAME, 'Android Browser']], [

						/FBAV\/([\w\.]+);/i                                                 // Facebook App for iOS
						], [VERSION, [NAME, 'Facebook']], [

						/version\/([\w\.]+).+?mobile\/\w+\s(safari)/i                       // Mobile Safari
						], [VERSION, [NAME, 'Mobile Safari']], [

						/version\/([\w\.]+).+?(mobile\s?safari|safari)/i                    // Safari & Safari Mobile
						], [VERSION, NAME], [

						/webkit.+?(mobile\s?safari|safari)(\/[\w\.]+)/i                     // Safari < 3.0
						], [NAME, [VERSION, mapper.str, maps.browser.oldsafari.version]], [

						/(konqueror)\/([\w\.]+)/i,                                          // Konqueror
						/(webkit|khtml)\/([\w\.]+)/i
						], [NAME, VERSION], [

						/(blackberry)\\s?\/([\w\.]+)/i                                      // Blackberry
						], [[NAME, "BlackBerry"], VERSION], [

						// Gecko based
						/(navigator|netscape)\/([\w\.-]+)/i                                 // Netscape
						], [[NAME, 'Netscape'], VERSION], [
						/(swiftfox)/i,                                                      // Swiftfox
						/(icedragon|iceweasel|camino|chimera|fennec|maemo\sbrowser|minimo|conkeror)[\/\s]?([\w\.\+]+)/i,
						/(firefox|seamonkey|k-meleon|icecat|iceape|firebird|phoenix)\/([\w\.-]+)/i,
						/(mozilla)\/([\w\.]+).+rv\:.+gecko\/\d+/i,                          // Mozilla

						// Other
						/(polaris|lynx|dillo|icab|doris|amaya|w3m|netsurf)[\/\s]?([\w\.]+)/i,
						/(links)\s\(([\w\.]+)/i,                                            // Links
						/(gobrowser)\/?([\w\.]+)*/i,                                        // GoBrowser
						/(ice\s?browser)\/v?([\w\._]+)/i,                                   // ICE Browser
						/(mosaic)[\/\s]([\w\.]+)/i                                          // Mosaic
						], [NAME, VERSION]

						/* /////////////////////
						// Media players BEGIN
						////////////////////////

						, [

						/(apple(?:coremedia|))\/((\d+)[\w\._]+)/i,                          // Generic Apple CoreMedia
						/(coremedia) v((\d+)[\w\._]+)/i
						], [NAME, VERSION], [

						/(aqualung|lyssna|bsplayer)\/((\d+)?[\w\.-]+)/i                     // Aqualung/Lyssna/BSPlayer
						], [NAME, VERSION], [

						/(ares|ossproxy)\s((\d+)[\w\.-]+)/i                                 // Ares/OSSProxy
						], [NAME, VERSION], [

						/(audacious|audimusicstream|amarok|bass|core|dalvik|gnomemplayer|music on console|nsplayer|psp-internetradioplayer|videos)\/((\d+)[\w\.-]+)/i,
						/(clementine|music player daemon)\s((\d+)[\w\.-]+)/i,               // Clementine/MPD
						/(lg player|nexplayer)\s((\d+)[\d\.]+)/i,
						/player\/(nexplayer|lg player)\s((\d+)[\w\.-]+)/i                   // NexPlayer/LG Player
						], [NAME, VERSION], [
						/(nexplayer)\s((\d+)[\w\.-]+)/i                                     // Nexplayer
						], [NAME, VERSION], [

						/(flrp)\/((\d+)[\w\.-]+)/i                                          // Flip Player
						], [[NAME, 'Flip Player'], VERSION], [

						/(fstream|nativehost|queryseekspider|ia-archiver|facebookexternalhit)/i
						], [NAME], [

						/(gstreamer) souphttpsrc (?:\([^\)]+\)){0,1} libsoup\/((\d+)[\w\.-]+)/i
						], [NAME, VERSION], [

						/(htc streaming player)\s[\w_]+\s\/\s((\d+)[\d\.]+)/i,              // HTC Streaming Player
						/(java|python-urllib|python-requests|wget|libcurl)\/((\d+)[\w\.-_]+)/i,
						/(lavf)((\d+)[\d\.]+)/i                                             // Lavf (FFMPEG)
						], [NAME, VERSION], [

						/(htc_one_s)\/((\d+)[\d\.]+)/i                                      // HTC One S
						], [[NAME, /_/g, ' '], VERSION], [

						/(mplayer)(?:\s|\/)(?:(?:sherpya-){0,1}svn)(?:-|\s)(r\d+(?:-\d+[\w\.-]+){0,1})/i
						], [NAME, VERSION], [

						/(mplayer)(?:\s|\/|[unkow-]+)((\d+)[\w\.-]+)/i                      // MPlayer
						], [NAME, VERSION], [

						/(mplayer)/i,                                                       // MPlayer (no other info)
						/(yourmuze)/i,                                                      // YourMuze
						/(media player classic|nero showtime)/i                             // Media Player Classic/Nero ShowTime
						], [NAME], [

						/(nero (?:home|scout))\/((\d+)[\w\.-]+)/i                           // Nero Home/Nero Scout
						], [NAME, VERSION], [

						/(nokia\d+)\/((\d+)[\w\.-]+)/i                                      // Nokia
						], [NAME, VERSION], [

						/\s(songbird)\/((\d+)[\w\.-]+)/i                                    // Songbird/Philips-Songbird
						], [NAME, VERSION], [

						/(winamp)3 version ((\d+)[\w\.-]+)/i,                               // Winamp
						/(winamp)\s((\d+)[\w\.-]+)/i,
						/(winamp)mpeg\/((\d+)[\w\.-]+)/i
						], [NAME, VERSION], [

						/(ocms-bot|tapinradio|tunein radio|unknown|winamp|inlight radio)/i  // OCMS-bot/tap in radio/tunein/unknown/winamp (no other info)
						], [NAME], [

						/(quicktime|rma|radioapp|radioclientapplication|soundtap|totem|stagefright|streamium)\/((\d+)[\w\.-]+)/i
						], [NAME, VERSION], [

						/(smp)((\d+)[\d\.]+)/i                                              // SMP
						], [NAME, VERSION], [

						/(vlc) media player - version ((\d+)[\w\.]+)/i,                     // VLC Videolan
						/(vlc)\/((\d+)[\w\.-]+)/i,
						/(xbmc|gvfs|xine|xmms|irapp)\/((\d+)[\w\.-]+)/i,                    // XBMC/gvfs/Xine/XMMS/irapp
						/(foobar2000)\/((\d+)[\d\.]+)/i,                                    // Foobar2000
						/(itunes)\/((\d+)[\d\.]+)/i                                         // iTunes
						], [NAME, VERSION], [

						/(wmplayer)\/((\d+)[\w\.-]+)/i,                                     // Windows Media Player
						/(windows-media-player)\/((\d+)[\w\.-]+)/i
						], [[NAME, /-/g, ' '], VERSION], [

						/windows\/((\d+)[\w\.-]+) upnp\/[\d\.]+ dlnadoc\/[\d\.]+ (home media server)/i
						], [VERSION, [NAME, 'Windows']], [

						/(com\.riseupradioalarm)\/((\d+)[\d\.]*)/i                          // RiseUP Radio Alarm
						], [NAME, VERSION], [

						/(rad.io)\s((\d+)[\d\.]+)/i,                                        // Rad.io
						/(radio.(?:de|at|fr))\s((\d+)[\d\.]+)/i
						], [[NAME, 'rad.io'], VERSION]

						//////////////////////
						// Media players END
						////////////////////*/

				],

				cpu : [[

						/(?:(amd|x(?:(?:86|64)[_-])?|wow|win)64)[;\)]/i                     // AMD64
						], [[ARCHITECTURE, 'amd64']], [

						/(ia32(?=;))/i                                                      // IA32 (quicktime)
						], [[ARCHITECTURE, util.lowerize]], [

						/((?:i[346]|x)86)[;\)]/i                                            // IA32
						], [[ARCHITECTURE, 'ia32']], [

						// PocketPC mistakenly identified as PowerPC
						/windows\s(ce|mobile);\sppc;/i
						], [[ARCHITECTURE, 'arm']], [

						/((?:ppc|powerpc)(?:64)?)(?:\smac|;|\))/i                           // PowerPC
						], [[ARCHITECTURE, /ower/, '', util.lowerize]], [

						/(sun4\w)[;\)]/i                                                    // SPARC
						], [[ARCHITECTURE, 'sparc']], [

						/((?:avr32|ia64(?=;))|68k(?=\))|arm(?:64|(?=v\d+;))|(?=atmel\s)avr|(?:irix|mips|sparc)(?:64)?(?=;)|pa-risc)/i
						], [[ARCHITECTURE, util.lowerize]]
				],

				device : [[

						/\((ipad|playbook);[\w\s\);-]+(rim|apple)/i                         // iPad/PlayBook
						], [MODEL, VENDOR, [TYPE, TABLET]], [

						/applecoremedia\/[\w\.]+ \((ipad)/                                  // iPad
						], [MODEL, [VENDOR, 'Apple'], [TYPE, TABLET]], [

						/(apple\s{0,1}tv)/i                                                 // Apple TV
						], [[MODEL, 'Apple TV'], [VENDOR, 'Apple']], [

						/(archos)\s(gamepad2?)/i,                                           // Archos
						/(hp).+(touchpad)/i,                                                // HP TouchPad
						/(kindle)\/([\w\.]+)/i,                                             // Kindle
						/\s(nook)[\w\s]+build\/(\w+)/i,                                     // Nook
						/(dell)\s(strea[kpr\s\d]*[\dko])/i                                  // Dell Streak
						], [VENDOR, MODEL, [TYPE, TABLET]], [

						/(kf[A-z]+)\sbuild\/[\w\.]+.*silk\//i                               // Kindle Fire HD
						], [MODEL, [VENDOR, 'Amazon'], [TYPE, TABLET]], [
						/(sd|kf)[0349hijorstuw]+\sbuild\/[\w\.]+.*silk\//i                  // Fire Phone
						], [[MODEL, mapper.str, maps.device.amazon.model], [VENDOR, 'Amazon'], [TYPE, MOBILE]], [

						/\((ip[honed|\s\w*]+);.+(apple)/i                                   // iPod/iPhone
						], [MODEL, VENDOR, [TYPE, MOBILE]], [
						/\((ip[honed|\s\w*]+);/i                                            // iPod/iPhone
						], [MODEL, [VENDOR, 'Apple'], [TYPE, MOBILE]], [

						/(blackberry)[\s-]?(\w+)/i,                                         // BlackBerry
						/(blackberry|benq|palm(?=\-)|sonyericsson|acer|asus|dell|huawei|meizu|motorola|polytron)[\s_-]?([\w-]+)*/i,
						/(hp)\s([\w\s]+\w)/i,                                               // HP iPAQ
						/(asus)-?(\w+)/i                                                    // Asus
						], [VENDOR, MODEL, [TYPE, MOBILE]], [
						/\(bb10;\s(\w+)/i                                                   // BlackBerry 10
						], [MODEL, [VENDOR, 'BlackBerry'], [TYPE, MOBILE]], [
						/android.+(transfo[prime\s]{4,10}\s\w+|eeepc|slider\s\w+|nexus 7)/i
						], [MODEL, [VENDOR, 'Asus'], [TYPE, TABLET]], [

						/(sony)\s(tablet\s[ps])\sbuild\//i,                                  // Sony
						/(sony)?(?:sgp.+)\sbuild\//i
						], [[VENDOR, 'Sony'], [MODEL, 'Xperia Tablet'], [TYPE, TABLET]], [
						/(?:sony)?(?:(?:(?:c|d)\d{4})|(?:so[-l].+))\sbuild\//i
						], [[VENDOR, 'Sony'], [MODEL, 'Xperia Phone'], [TYPE, MOBILE]], [

						/\s(ouya)\s/i,                                                      // Ouya
						/(nintendo)\s([wids3u]+)/i                                          // Nintendo
						], [VENDOR, MODEL, [TYPE, CONSOLE]], [

						/android.+;\s(shield)\sbuild/i                                      // Nvidia
						], [MODEL, [VENDOR, 'Nvidia'], [TYPE, CONSOLE]], [

						/(playstation\s[3portablevi]+)/i                                    // Playstation
						], [MODEL, [VENDOR, 'Sony'], [TYPE, CONSOLE]], [

						/(sprint\s(\w+))/i                                                  // Sprint Phones
						], [[VENDOR, mapper.str, maps.device.sprint.vendor], [MODEL, mapper.str, maps.device.sprint.model], [TYPE, MOBILE]], [

						/(lenovo)\s?(S(?:5000|6000)+(?:[-][\w+]))/i                         // Lenovo tablets
						], [VENDOR, MODEL, [TYPE, TABLET]], [

						/(htc)[;_\s-]+([\w\s]+(?=\))|\w+)*/i,                               // HTC
						/(zte)-(\w+)*/i,                                                    // ZTE
						/(alcatel|geeksphone|huawei|lenovo|nexian|panasonic|(?=;\s)sony)[_\s-]?([\w-]+)*/i
						], [VENDOR, [MODEL, /_/g, ' '], [TYPE, MOBILE]], [
								
						/(nexus\s9)/i                                                       // HTC Nexus 9
						], [MODEL, [VENDOR, 'HTC'], [TYPE, TABLET]], [

						/[\s\(;](xbox(?:\sone)?)[\s\);]/i                                   // Microsoft Xbox
						], [MODEL, [VENDOR, 'Microsoft'], [TYPE, CONSOLE]], [
						/(kin\.[onetw]{3})/i                                                // Microsoft Kin
						], [[MODEL, /\./g, ' '], [VENDOR, 'Microsoft'], [TYPE, MOBILE]], [
						/\s(milestone|droid(?:[2-4x]|\s(?:bionic|x2|pro|razr))?(:?\s4g)?)[\w\s]+build\//i,
						/mot[\s-]?(\w+)*/i,
						/(XT\d{3,4}) build\//i
						], [MODEL, [VENDOR, 'Motorola'], [TYPE, MOBILE]], [
						/android.+\s(mz60\d|xoom[\s2]{0,2})\sbuild\//i
						], [MODEL, [VENDOR, 'Motorola'], [TYPE, TABLET]], [

						/android.+((sch-i[89]0\d|shw-m380s|gt-p\d{4}|gt-n8000|sgh-t8[56]9|nexus 10))/i,
						/((SM-T\w+))/i
						], [[VENDOR, 'Samsung'], MODEL, [TYPE, TABLET]], [                  // Samsung
						/((s[cgp]h-\w+|gt-\w+|galaxy\snexus|sm-n900))/i,
						/(sam[sung]*)[\s-]*(\w+-?[\w-]*)*/i,
						/sec-((sgh\w+))/i
						], [[VENDOR, 'Samsung'], MODEL, [TYPE, MOBILE]], [
						/(samsung);smarttv/i
						], [VENDOR, MODEL, [TYPE, SMARTTV]], [

						/\(dtv[\);].+(aquos)/i                                              // Sharp
						], [MODEL, [VENDOR, 'Sharp'], [TYPE, SMARTTV]], [
						/sie-(\w+)*/i                                                       // Siemens
						], [MODEL, [VENDOR, 'Siemens'], [TYPE, MOBILE]], [

						/(maemo|nokia).*(n900|lumia\s\d+)/i,                                // Nokia
						/(nokia)[\s_-]?([\w-]+)*/i
						], [[VENDOR, 'Nokia'], MODEL, [TYPE, MOBILE]], [

						/android\s3\.[\s\w;-]{10}(a\d{3})/i                                 // Acer
						], [MODEL, [VENDOR, 'Acer'], [TYPE, TABLET]], [

						/android\s3\.[\s\w;-]{10}(lg?)-([06cv9]{3,4})/i                     // LG Tablet
						], [[VENDOR, 'LG'], MODEL, [TYPE, TABLET]], [
						/(lg) netcast\.tv/i                                                 // LG SmartTV
						], [VENDOR, MODEL, [TYPE, SMARTTV]], [
						/(nexus\s[45])/i,                                                   // LG
						/lg[e;\s\/-]+(\w+)*/i
						], [MODEL, [VENDOR, 'LG'], [TYPE, MOBILE]], [

						/android.+(ideatab[a-z0-9\-\s]+)/i                                  // Lenovo
						], [MODEL, [VENDOR, 'Lenovo'], [TYPE, TABLET]], [

						/linux;.+((jolla));/i                                               // Jolla
						], [VENDOR, MODEL, [TYPE, MOBILE]], [

						/((pebble))app\/[\d\.]+\s/i                                         // Pebble
						], [VENDOR, MODEL, [TYPE, WEARABLE]], [

						/android.+;\s(glass)\s\d/i                                          // Google Glass
						], [MODEL, [VENDOR, 'Google'], [TYPE, WEARABLE]], [

						/android.+(\w+)\s+build\/hm\1/i,                                        // Xiaomi Hongmi 'numeric' models
						/android.+(hm[\s\-_]*note?[\s_]*(?:\d\w)?)\s+build/i,                   // Xiaomi Hongmi
						/android.+(mi[\s\-_]*(?:one|one[\s_]plus)?[\s_]*(?:\d\w)?)\s+build/i    // Xiaomi Mi
						], [[MODEL, /_/g, ' '], [VENDOR, 'Xiaomi'], [TYPE, MOBILE]], [

						/(mobile|tablet);.+rv\:.+gecko\//i                                  // Unidentifiable
						], [[TYPE, util.lowerize], VENDOR, MODEL]

						/*//////////////////////////
						// TODO: move to string map
						////////////////////////////

						/(C6603)/i                                                          // Sony Xperia Z C6603
						], [[MODEL, 'Xperia Z C6603'], [VENDOR, 'Sony'], [TYPE, MOBILE]], [
						/(C6903)/i                                                          // Sony Xperia Z 1
						], [[MODEL, 'Xperia Z 1'], [VENDOR, 'Sony'], [TYPE, MOBILE]], [

						/(SM-G900[F|H])/i                                                   // Samsung Galaxy S5
						], [[MODEL, 'Galaxy S5'], [VENDOR, 'Samsung'], [TYPE, MOBILE]], [
						/(SM-G7102)/i                                                       // Samsung Galaxy Grand 2
						], [[MODEL, 'Galaxy Grand 2'], [VENDOR, 'Samsung'], [TYPE, MOBILE]], [
						/(SM-G530H)/i                                                       // Samsung Galaxy Grand Prime
						], [[MODEL, 'Galaxy Grand Prime'], [VENDOR, 'Samsung'], [TYPE, MOBILE]], [
						/(SM-G313HZ)/i                                                      // Samsung Galaxy V
						], [[MODEL, 'Galaxy V'], [VENDOR, 'Samsung'], [TYPE, MOBILE]], [
						/(SM-T805)/i                                                        // Samsung Galaxy Tab S 10.5
						], [[MODEL, 'Galaxy Tab S 10.5'], [VENDOR, 'Samsung'], [TYPE, TABLET]], [
						/(SM-G800F)/i                                                       // Samsung Galaxy S5 Mini
						], [[MODEL, 'Galaxy S5 Mini'], [VENDOR, 'Samsung'], [TYPE, MOBILE]], [
						/(SM-T311)/i                                                        // Samsung Galaxy Tab 3 8.0
						], [[MODEL, 'Galaxy Tab 3 8.0'], [VENDOR, 'Samsung'], [TYPE, TABLET]], [

						/(R1001)/i                                                          // Oppo R1001
						], [MODEL, [VENDOR, 'OPPO'], [TYPE, MOBILE]], [
						/(X9006)/i                                                          // Oppo Find 7a
						], [[MODEL, 'Find 7a'], [VENDOR, 'Oppo'], [TYPE, MOBILE]], [
						/(R2001)/i                                                          // Oppo YOYO R2001
						], [[MODEL, 'Yoyo R2001'], [VENDOR, 'Oppo'], [TYPE, MOBILE]], [
						/(R815)/i                                                           // Oppo Clover R815
						], [[MODEL, 'Clover R815'], [VENDOR, 'Oppo'], [TYPE, MOBILE]], [
						 /(U707)/i                                                          // Oppo Find Way S
						], [[MODEL, 'Find Way S'], [VENDOR, 'Oppo'], [TYPE, MOBILE]], [

						/(T3C)/i                                                            // Advan Vandroid T3C
						], [MODEL, [VENDOR, 'Advan'], [TYPE, TABLET]], [
						/(ADVAN T1J\+)/i                                                    // Advan Vandroid T1J+
						], [[MODEL, 'Vandroid T1J+'], [VENDOR, 'Advan'], [TYPE, TABLET]], [
						/(ADVAN S4A)/i                                                      // Advan Vandroid S4A
						], [[MODEL, 'Vandroid S4A'], [VENDOR, 'Advan'], [TYPE, MOBILE]], [

						/(V972M)/i                                                          // ZTE V972M
						], [MODEL, [VENDOR, 'ZTE'], [TYPE, MOBILE]], [

						/(i-mobile)\s(IQ\s[\d\.]+)/i                                        // i-mobile IQ
						], [VENDOR, MODEL, [TYPE, MOBILE]], [
						/(IQ6.3)/i                                                          // i-mobile IQ IQ 6.3
						], [[MODEL, 'IQ 6.3'], [VENDOR, 'i-mobile'], [TYPE, MOBILE]], [
						/(i-mobile)\s(i-style\s[\d\.]+)/i                                   // i-mobile i-STYLE
						], [VENDOR, MODEL, [TYPE, MOBILE]], [
						/(i-STYLE2.1)/i                                                     // i-mobile i-STYLE 2.1
						], [[MODEL, 'i-STYLE 2.1'], [VENDOR, 'i-mobile'], [TYPE, MOBILE]], [
						
						/(mobiistar touch LAI 512)/i                                        // mobiistar touch LAI 512
						], [[MODEL, 'Touch LAI 512'], [VENDOR, 'mobiistar'], [TYPE, MOBILE]], [

						/////////////
						// END TODO
						///////////*/

				],

				engine : [[

						/(presto)\/([\w\.]+)/i,                                             // Presto
						/(webkit|trident|netfront|netsurf|amaya|lynx|w3m)\/([\w\.]+)/i,     // WebKit/Trident/NetFront/NetSurf/Amaya/Lynx/w3m
						/(khtml|tasman|links)[\/\s]\(?([\w\.]+)/i,                          // KHTML/Tasman/Links
						/(icab)[\/\s]([23]\.[\d\.]+)/i                                      // iCab
						], [NAME, VERSION], [

						/rv\:([\w\.]+).*(gecko)/i                                           // Gecko
						], [VERSION, NAME]
				],

				os : [[

						// Windows based
						/microsoft\s(windows)\s(vista|xp)/i                                 // Windows (iTunes)
						], [NAME, VERSION], [
						/(windows)\snt\s6\.2;\s(arm)/i,                                     // Windows RT
						/(windows\sphone(?:\sos)*|windows\smobile|windows)[\s\/]?([ntce\d\.\s]+\w)/i
						], [[NAME, mapper.str, maps.os.windows.name], [VERSION, mapper.str, maps.os.windows.version]], [
						/(win(?=3|9|n)|win\s9x\s)([nt\d\.]+)/i
						], [[NAME, 'Windows'], [VERSION, mapper.str, maps.os.windows.version]], [

						// Mobile/Embedded OS
						/\((bb)(10);/i                                                      // BlackBerry 10
						], [[NAME, 'BlackBerry'], VERSION], [
						/(blackberry)\w*\/?([\w\.]+)*/i,                                    // Blackberry
						/(tizen)[\/\s]([\w\.]+)/i,                                          // Tizen
						/(android|webos|palm\os|qnx|bada|rim\stablet\sos|meego|contiki)[\/\s-]?([\w\.]+)*/i,
						/linux;.+(sailfish);/i                                              // Sailfish OS
						], [NAME, VERSION], [
						/(symbian\s?o?s?|symbos|s60(?=;))[\/\s-]?([\w\.]+)*/i               // Symbian
						], [[NAME, 'Symbian'], VERSION], [
						/\((series40);/i                                                    // Series 40
						], [NAME], [
						/mozilla.+\(mobile;.+gecko.+firefox/i                               // Firefox OS
						], [[NAME, 'Firefox OS'], VERSION], [

						// Console
						/(nintendo|playstation)\s([wids3portablevu]+)/i,                    // Nintendo/Playstation

						// GNU/Linux based
						/(mint)[\/\s\(]?(\w+)*/i,                                           // Mint
						/(mageia|vectorlinux)[;\s]/i,                                       // Mageia/VectorLinux
						/(joli|[kxln]?ubuntu|debian|[open]*suse|gentoo|arch|slackware|fedora|mandriva|centos|pclinuxos|redhat|zenwalk|linpus)[\/\s-]?([\w\.-]+)*/i,
						/(hurd|linux)\s?([\w\.]+)*/i,                                       // Hurd/Linux
						/(gnu)\s?([\w\.]+)*/i                                               // GNU
						], [[NAME, 'Linux'], VERSION], [

						/(cros)\s[\w]+\s([\w\.]+\w)/i                                       // Chromium OS
						], [[NAME, 'Chromium OS'], VERSION],[

						// Solaris
						/(sunos)\s?([\w\.]+\d)*/i                                           // Solaris
						], [[NAME, 'Solaris'], VERSION], [

						// BSD based
						/\s([frentopc-]{0,4}bsd|dragonfly)\s?([\w\.]+)*/i                   // FreeBSD/NetBSD/OpenBSD/PC-BSD/DragonFly
						], [[NAME, 'Linux'], VERSION],[

						/(iphone)(?:.*os\s*([\w]+)*\slike\smac|;\sopera)/i                  // iOS
						], [[NAME, 'iPhone'], [VERSION, /_/g, '.']], [

						/(ipad)(?:.*os\s*([\w]+)*\slike\smac|;\sopera)/i                    // iOS
						], [[NAME, 'iPad'], [VERSION, /_/g, '.']], [

						/(mac\sos\sx)\s?([\w\s\.]+\w)*/i,
						/(macintosh|mac(?=_powerpc)\s)/i                                    // Mac OS
						], [[NAME, 'Mac'], [VERSION, /_/g, '.']], [

						// Other
						/((?:open)?solaris)[\/\s-]?([\w\.]+)*/i,                            // Solaris
						/(haiku)\s(\w+)/i,                                                  // Haiku
						/(aix)\s((\d)(?=\.|\)|\s)[\w\.]*)*/i,                               // AIX
						/(plan\s9|minix|beos|os\/2|amigaos|morphos|risc\sos|openvms)/i,
						/(unix)\s?([\w\.]+)*/i                                              // UNIX
						], [NAME, VERSION]
				]
		};


		/////////////////
		// Constructor
		////////////////


		var UAParser = function (uastring, extensions) {

				if (!(this instanceof UAParser)) {
						return new UAParser(uastring, extensions).getResult();
				}

				var ua = uastring || ((window && window.navigator && window.navigator.userAgent) ? window.navigator.userAgent : EMPTY);
				var rgxmap = extensions ? util.extend(regexes, extensions) : regexes;

				this.getBrowser = function () {
						var browser = mapper.rgx.apply(this, rgxmap.browser);
						browser.major = util.major(browser.version);
						return browser;
				};
				this.getCPU = function () {
						return mapper.rgx.apply(this, rgxmap.cpu);
				};
				this.getDevice = function () {
						return mapper.rgx.apply(this, rgxmap.device);
				};
				this.getEngine = function () {
						return mapper.rgx.apply(this, rgxmap.engine);
				};
				this.getOS = function () {
						return mapper.rgx.apply(this, rgxmap.os);
				};
				this.getResult = function() {
						return {
								ua      : this.getUA(),
								browser : this.getBrowser(),
								engine  : this.getEngine(),
								os      : this.getOS(),
								device  : this.getDevice(),
								cpu     : this.getCPU()
						};
				};
				this.getUA = function () {
						return ua;
				};
				this.setUA = function (uastring) {
						ua = uastring;
						return this;
				};
				this.setUA(ua);
				return this;
		};

		UAParser.VERSION = LIBVERSION;
		UAParser.BROWSER = {
				NAME    : NAME,
				MAJOR   : MAJOR, // deprecated
				VERSION : VERSION
		};
		UAParser.CPU = {
				ARCHITECTURE : ARCHITECTURE
		};
		UAParser.DEVICE = {
				MODEL   : MODEL,
				VENDOR  : VENDOR,
				TYPE    : TYPE,
				CONSOLE : CONSOLE,
				MOBILE  : MOBILE,
				SMARTTV : SMARTTV,
				TABLET  : TABLET,
				WEARABLE: WEARABLE,
				EMBEDDED: EMBEDDED
		};
		UAParser.ENGINE = {
				NAME    : NAME,
				VERSION : VERSION
		};
		UAParser.OS = {
				NAME    : NAME,
				VERSION : VERSION
		};


		///////////
		// Export
		//////////


		// check js environment
		if (typeof(exports) !== UNDEF_TYPE) {
				// nodejs env
				if (typeof module !== UNDEF_TYPE && module.exports) {
						exports = module.exports = UAParser;
				}
				exports.UAParser = UAParser;
		} else {
				// requirejs env (optional)
				if (typeof(define) === FUNC_TYPE && define.amd) {
						define(function () {
								return UAParser;
						});
				} else {
						// browser env
						window.UAParser = UAParser;
				}
		}

		// jQuery/Zepto specific (optional)
		// Note: 
		//   In AMD env the global scope should be kept clean, but jQuery is an exception.
		//   jQuery always exports to global scope, unless jQuery.noConflict(true) is used,
		//   and we should catch that.
		var $ = window.jQuery || window.Zepto;
		if (typeof $ !== UNDEF_TYPE) {
				var parser = new UAParser();
				$.ua = parser.getResult();
				$.ua.get = function() {
						return parser.getUA();
				};
				$.ua.set = function (uastring) {
						parser.setUA(uastring);
						var result = parser.getResult();
						for (var prop in result) {
								$.ua[prop] = result[prop];
						}
				};
		}

})(this);

}, {}],
11: [function(require, module, exports) {
/* jshint bitwise: false, laxbreak: true */

/**
 * Taken straight from jed's gist: https://gist.github.com/982883
 *
 * Returns a random v4 UUID of the form xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx,
 * where each x is replaced with a random hexadecimal digit from 0 to f, and
 * y is replaced with a random hexadecimal digit from 8 to b.
 */

var uuid = function(a) {
	return a           // if the placeholder was passed, return
			? (              // a random number from 0 to 15
			a ^            // unless b is 8,
			Math.random()  // in which case
			* 16           // a random number from
			>> a / 4         // 8 to 11
			).toString(16) // in hexadecimal
			: (              // or otherwise a concatenated string:
			[1e7] +        // 10000000 +
			-1e3 +         // -1000 +
			-4e3 +         // -4000 +
			-8e3 +         // -80000000 +
			-1e11          // -100000000000,
			).replace(     // replacing
			/[018]/g,    // zeroes, ones, and eights with
			uuid         // random hex digits
	);
};

module.exports = uuid;

}, {}],
12: [function(require, module, exports) {
module.exports = '2.6.2';

}, {}],
13: [function(require, module, exports) {
var type = require('./type');

/*
 * Wrapper for a user properties JSON object that supports operations.
 * Note: if a user property is used in multiple operations on the same Identify object,
 * only the first operation will be saved, and the rest will be ignored.
 */

var AMP_OP_ADD = '$add';
var AMP_OP_SET = '$set';
var AMP_OP_SET_ONCE = '$setOnce';
var AMP_OP_UNSET = '$unset';

var log = function(s) {
	// console.log('[TongDao] ' + s);
};

var Identify = function() {
	this.userPropertiesOperations = {};
	this.properties = []; // keep track of keys that have been added
};

Identify.prototype.add = function(property, value) {
	if (type(value) === 'number' || type(value) === 'string') {
		this._addOperation(AMP_OP_ADD, property, value);
	} else {
		log('Unsupported type for value: ' + type(value) + ', expecting number or string');
	}
	return this;
};

Identify.prototype.set = function(property, value) {
	this._addOperation(AMP_OP_SET, property, value);
	return this;
};

Identify.prototype.setOnce = function(property, value) {
	this._addOperation(AMP_OP_SET_ONCE, property, value);
	return this;
};

Identify.prototype.unset = function(property) {
	this._addOperation(AMP_OP_UNSET, property, '-');
	return this;
};

Identify.prototype._addOperation = function(operation, property, value) {
	// check that property wasn't already used in this Identify
	if (this.properties.indexOf(property) !== -1) {
		log('User property "' + property + '" already used in this identify, skipping operation ' + operation);
		return;
	}

	if (!(operation in this.userPropertiesOperations)){
		this.userPropertiesOperations[operation] = {};
	}
	this.userPropertiesOperations[operation][property] = value;
	this.properties.push(property);
};

module.exports = Identify;

}, {"./type":14}],
14: [function(require, module, exports) {
/* Taken from: https://github.com/component/type */

/**
 * toString ref.
 */

var toString = Object.prototype.toString;

/**
 * Return the type of `val`.
 *
 * @param {Mixed} val
 * @return {String}
 * @api public
 */

module.exports = function(val){
	switch (toString.call(val)) {
		case '[object Date]': return 'date';
		case '[object RegExp]': return 'regexp';
		case '[object Arguments]': return 'arguments';
		case '[object Array]': return 'array';
		case '[object Error]': return 'error';
	}

	if (val === null) {
		return 'null';
	}
	if (val === undefined) {
		return 'undefined';
	}
	if (val !== val) {
		return 'nan';
	}
	if (val && val.nodeType === 1) {
		return 'element';
	}

	if (typeof Buffer !== 'undefined' && Buffer.isBuffer(val)) {
		return 'buffer';
	}

	val = val.valueOf ? val.valueOf() : Object.prototype.valueOf.apply(val);
	return typeof val;
};

}, {}]}, {}, {"1":""})
);