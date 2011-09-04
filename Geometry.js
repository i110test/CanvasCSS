var Geometry;

(function() {

Geometry = {

	transformVector : function(vector, transform) {
	    return [
	        transform[0] * vector[0] + transform[2] * vector[1] + transform[4],
	        transform[1] * vector[0] + transform[3] * vector[1] + transform[5]
	    ];
	}	
};

})();
