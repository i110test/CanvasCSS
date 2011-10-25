var CSSResolver = {};

(function(C) {

C._calcSelectorScore = function(selectorText) {
    var ancestry = selectorText.split(/ +/);
    var score = 0;
    for (var i = 0; i < ancestry.length; i++) {
        var c = ancestry[i].charAt(0);
        if (c === '#') {
            score += 0xffff;
        } else if (c === '.') {
            score += 0xff;
        } else if (c === '*') {
        } else {
            score += 1;
        }
    }
    return score;
};
// TODO: some Android don't have webkitMatchesSelector
C.resolve = function(el, prop) {
    var maxScore;
    var computedStyle = getComputedStyle(el);
    var value;
    var regex, m, styles, styleSheet, cssRule;
    var score, styleValue;
    var i, j, k;

    value = computedStyle.getPropertyValue(prop);
    if (value) {
        return value;
    }

    // the way to hell..
	regex = new RegExp(prop + '\\s*:\\s*(.*?)\\s*;', 'g');
    styles = [];
    for (i = 0; i < document.styleSheets.length; i++) {
        styleSheet = document.styleSheets[i];
        for (j = 0; j < styleSheet.cssRules.length; j++) {
            cssRule = styleSheet.cssRules[j];
            if (! el.webkitMatchesSelector(cssRule.selectorText)) {
                continue;
            }

            // get last appeared value
            regex.lastIndex = 0;
            while ((m = regex.exec(cssRule.cssText))) {}
            if (! m) {
                continue;
            }
            styleValue = m[1]; 

            // calc score
            var splitted = cssRule.selectorText.split(/\s*,\s*/);
            maxScore = 0;
            for (k = 0; k < splitted.length; k++) {
                if (! el.webkitMatchesSelector(splitted[k])) {
                    continue;
                }
                score = C._calcSelectorScore(splitted[k]);
                if (score >= maxScore) {
                    maxScore = score;
                }
            }

            styles.push({
                value : styleValue,
                score : maxScore
            });
        }
    }

    // pick max-scored last-appeared style
    maxScore = 0;
    for (i = 0; i < styles.length; i++) {
        if (styles[i].score >= maxScore) {
            value = styles[i].value;
            maxScore = styles[i].score;
        }
    }

    return value;
};

})(CSSResolver);
