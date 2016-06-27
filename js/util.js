	
	function fix360(angle) {
	    while (angle > 360) {
	        angle -= 360
	    }
	    while (angle < 0) {
	        angle += 360
	    }
	    return (angle);
	}

	function getParameterByName(name, url) {
	    if (!url) url = window.location.href;
	    name = name.replace(/[\[\]]/g, "\\$&");
	    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
	        results = regex.exec(url);
	    if (!results) return null;
	    if (!results[2]) return '';
	    return decodeURIComponent(results[2].replace(/\+/g, " "));
	}

	function toRadians(degrees) {
	    return degrees * Math.PI / 180;
	}


	function getAspectRatio() {
	var w = window.innerWidth
	|| document.documentElement.clientWidth
	|| document.body.clientWidth;

	var h = window.innerHeight
	|| document.documentElement.clientHeight
	|| document.body.clientHeight;
	var aspectRatio = w/h;
	console.log("Aspect Ratio="+aspectRatio);
	return aspectRatio;
	}


