/*
main_inject.js - is injected into all pages of the areas monitored
 */

// You will want to set the location of your server to get you up and running
var serverDomain = "";
var serverBase = "https://" + serverDomain + "/collector";


/* ==============================================================================
 Debug Properties 
 ==============================================================================*/

debug = true;
function l(msg) {
	if (debug)
		console.log(msg);
}

var gid = 5;

/*
 * ==============================================================================
 * Injection site-specific script on the page
 * ================================================================================
 */

var monitor;

function getParam(param) {
	var hash;
	var hashes = window.location.href.slice(
			window.location.href.indexOf('?') + 1).split('&');
	for ( var i = 0; i < hashes.length; i++) {
		hash = hashes[i].split('=');
		if (hash[0] == param)
			return hash[1];
	}
	return null;
}

function initBinds() {
	l("Initialize logger");

	try{

		if (document.domain == "google.com")
			monitor = googleScript();
		else if (document.domain == "google.ca")
			monitor = googleScript();
		else if (document.domain == "www.google.com")
			monitor = googleScript();
		else if (document.domain == "www.google.ca")
			monitor = googleScript();
		else if (document.domain == "encrypted.google.ca")
			monitor = googleScript();
		else if (document.domain == "encrypted.google.com")
			monitor = googleScript();
		
		else if (document.domain == serverDomain)
			monitor = subScript();

		else
			otherScript();
	} catch (e) {
		chrome.extension.sendRequest({
			command : "submitErrorReport",
			context : "In initBinds()",
			site : document.location.href,
			exception : {
				name : e.name,
				message : e.message,
				stack : e.stack
			}
		});
	}
	return;
}

var oldHash;

function subScript() {
	l("We are in the site collection. Populating fields ...");

	if (location.href == serverBase + "/init.php") {
		$('#gid').html(gid);

		var pollForPID = function() {
			setTimeout(function() {
				var pid = $('#pid').html();
				if (pid) {
					chrome.extension.sendRequest({
						command : "setPID",
						pid : pid
					});
					window.close();
				} else {
					pollForPID();
				}
			}, 200);
		};
		pollForPID();
	}
}

function zeroPad(num) {
	return String('00' + num).slice(-2);
}

function formatTime(timestamp) {
	var dt = new Date(parseInt(timestamp));
	var datestr = zeroPad(dt.getDate()) + "/" + zeroPad(dt.getMonth()) + "/"
	+ dt.getFullYear();
	datestr += " " + zeroPad(dt.getHours()) + ":" + zeroPad(dt.getMinutes())
	+ ":" + zeroPad(dt.getSeconds());
	return datestr;
}

function logQuery(site, query, page) {
	if (query == "")
		return;
	l("Logging query: " + query);

	chrome.extension.sendRequest({
		command : "logQuery",
		site : site,
		query : query,
		page : page
	});

	l("Query logged.");
}

function logNavigation(url, title, referrer) {
	l("Logging navigation: " + title + ", " + url + ", " + referrer);
	chrome.extension.sendRequest({
		command : "logNavigation",
		url : url,
		title : title,
		referrer : referrer
	});
}

function logClick(site, query, title, url, page) {
	l("Logging click: " + query + "," + title + "," + url + "," + page);

	chrome.extension.sendRequest({
		command : "logClick",
		site : site,
		query : query,
		title : title,
		url : url,
		page : page
	});

	l("Click logged. Directing to url...");
	location.href = url;
}

function googleScript() {
	l("Installing Google Specific Monitor");

	l("Disabling Instant Search (if present)");
	if ((location.href.match("/search?") || location.href.match("/webhp?"))
			&& !location.href.match("complete"))
		return (location.href = location.href + "&complete=0");

	if (location.href == "http://google.com/"
		|| location.href == "http://google.ca/")
		return (location.href = location.href + "webhp?complete=0");

	if (location.href == "http://www.google.com/"
		|| location.href == "http://www.google.ca/")
		return (location.href = location.href + "webhp?complete=0");

	var query = getParam("q");
	var page = getParam("start");
	page = (page) ? (page / 10) + 1 : 1;

	if (query)
		logQuery("Google", query, page);

	$("a.l").click(
			function() {
				var url = "";
				if ((this.href.indexOf("google.com/url" != -1) || this.href
						.indexOf("google.ca/url") != -1))
					url = getParameterByName("url", this.href);
				if (url.length == 0)
					url = this.href;
				logClick("Google", query, $(this).text(), url, page);
				return false;
			});
	
	var url = document.location.href;
	var title = document.title;
	var referrer = document.referrer;
	
	logNavigation(url,title,referrer);
}

function otherScript() {
	runIfNotBlacklisted(document.domain,function() {

		var url = document.location.href;
		var title = document.title;
		var referrer = document.referrer;

		logNavigation(url, title, referrer);
	});
}

function runIfNotBlacklisted(domain,exec) {
	chrome.extension.sendRequest({
		command : "getBlacklist"
	}, function (blacklist) {
		if (blacklist) {
			for (var i=0; i < blacklist.length; i++) {
				if (blacklist[i] == domain)
					return;
			}
			exec();
		}
	});
}

function checkBlacklist(url) {
	var blacklist = window.localStorage.getItem("blacklist");
	if (blacklist)
	{
		blacklist = JSON.parse(blacklist);
		for ( var i = 0; i < blacklist.length; i++) {
			if (url)
				if (url.match(blacklist[i]))
					return true;
		}
	}
	return false;

}

/**
 * 
 * URL encode / decode http://www.webtoolkit.info/
 * 
 */

var Url = {

		// public method for url encoding
		encode : function(string) {
			return escape(this._utf8_encode(string));
		},

		// public method for url decoding
		decode : function(string) {
			return this._utf8_decode(unescape(string));
		},

		// private method for UTF-8 encoding
		_utf8_encode : function(string) {
			string = string.replace(/\r\n/g, "\n");
			var utftext = "";

			for ( var n = 0; n < string.length; n++) {

				var c = string.charCodeAt(n);

				if (c < 128) {
					utftext += String.fromCharCode(c);
				} else if ((c > 127) && (c < 2048)) {
					utftext += String.fromCharCode((c >> 6) | 192);
					utftext += String.fromCharCode((c & 63) | 128);
				} else {
					utftext += String.fromCharCode((c >> 12) | 224);
					utftext += String.fromCharCode(((c >> 6) & 63) | 128);
					utftext += String.fromCharCode((c & 63) | 128);
				}

			}

			return utftext;
		},

		// private method for UTF-8 decoding
		_utf8_decode : function(utftext) {
			var string = "";
			var i = 0;
			var c = c1 = c2 = 0;

			while (i < utftext.length) {

				c = utftext.charCodeAt(i);

				if (c < 128) {
					string += String.fromCharCode(c);
					i++;
				} else if ((c > 191) && (c < 224)) {
					c2 = utftext.charCodeAt(i + 1);
					string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
					i += 2;
				} else {
					c2 = utftext.charCodeAt(i + 1);
					c3 = utftext.charCodeAt(i + 2);
					string += String.fromCharCode(((c & 15) << 12)
							| ((c2 & 63) << 6) | (c3 & 63));
					i += 3;
				}

			}

			return string;
		}

};

function getParameterByName(name, url) {
	name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
	var regexS = "[\\?&]" + name + "=([^&#]*)";
	var regex = new RegExp(regexS);
	var results = regex.exec(url);
	if (results == null)
		return "";
	else
		return decodeURIComponent(results[1].replace(/\+/g, " "));
}

initBinds();