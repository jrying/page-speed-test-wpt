
var publicWptHost = 'www.webpagetest.org';
var privateWptHost = 'mirador.corp.yahoo.com';
var publicWptKey = '718f56a5c3d74b9cb5059adfcd7e3da9';

function wpt(config){
    this.config = config;
    this.objRun = {};
    this.objResult = {};
    this.testInfo = {'testId': '', 'reportUrl': '', 'startTime': '','status': '', 'runs': ''};
    this.refreshInterval;
    this.enableRefresh = false;
    this.isTestFinished = true;
}

/*
    config: {'testurl': ... , 'run': ...}
*/
wpt.prototype.sendRunRequest = function(){
    var that = this;
    if (!this.config.testurl) {console.log('Error: no testurl found'); return;}
    $.ajax ( {
        type:       'GET',
        url:        'http://'+publicWptHost+'/runtest.php',
        dataType:   'jsonp',
        data:       {'url': that.config.testurl, 'runs': that.config.runs || '1', 'f': 'json', 'k': publicWptKey, 'fvonly': 1},
        success:    function (response) {
            //console.log('Result response: ' + JSON.stringify(response));
            that.dispatchRunResponse(response); 
            that.sendResultRequest();
            that.enableAutoRefresh();
        },
        failure:    function () {
            console.log("ajax failed");
        }
    } );
}

wpt.prototype.sendResultRequest = function(config){
    var that = this,
        data = this.objRun.data;
    if (!data.jsonUrl) {callback({'content': 'Error: no dataurl found'}); return;}
    $.ajax ( {
        type:       'GET',
        url:        data.jsonUrl,
        dataType:   'jsonp',
        data:       {},
        success:    function (response) {
            //console.log('Result response: ' + JSON.stringify(response));
            that.dispatchResultResponse(response); 
            that.finish();
        },
        failure:    function () {
            console.log("ajax failed");
        }
    } );
}

wpt.prototype.dispatchRunResponse = function(response){
    if(!response.data) return;
    this.objRun = response;
    this.testInfo.testId = response.data.testId || '';
    this.testInfo.reportUrl = response.data.userUrl || '';
    this.testInfo.runs = this.config.runs;
}

wpt.prototype.dispatchResultResponse = function(response){
    if(!response.data) return;
    this.objResult = response;

    this.testInfo.startTime = response.data.startTime || this.testInfo.startTime || '';
    this.testInfo.status = response.data.statusText || response.statusText || this.testInfo.status || '';

    // Render header
    this.objResult.info = this.renderHtmlInfo(response.data);

    // Render body when test is finished
    if(response.statusCode == 200){
        this.objResult.result = this.renderHtmlResult(response.data);
    }
}


wpt.prototype.enableAutoRefresh = function(){
    var that = this;
    this.isTestFinished = false;
    this.refreshInterval = setInterval(function(){that.checkFinished()}, 6000);//10s
    this.enableRefresh = true;
}

wpt.prototype.disableAutoRefresh = function(){
    clearInterval(this.refreshInterval);
    this.enableRefresh = false;
}

wpt.prototype.configAutoRefresh = function(enable){
    if(this.refreshEnabled){
        this.disableAutoRefresh();
    }
    else{
        this.enableAutoRefresh();
    }
}

wpt.prototype.checkFinished = function(){
    //is finished
    if(this.isTestFinished) {
        this.disableAutoRefresh();
        console.log("Test finished");
        return;
    }
    this.sendResultRequest({}, wpt.prototype.finish);
}

wpt.prototype.finish = function(result){
    result = result || this.objResult;
    if(result.statusCode == 200){
        this.isTestFinished = true;
        writeTestInfo(this.config.executeId, result.info);
        writeTestResult(this.config.executeId, result.result);
        endTest(this.config.executeId, this.objResult.summary);
        return;
    }
    writeTestInfo(this.config.executeId, result.info);
}

wpt.prototype.renderHtmlInfo = function(){
    var content = '<ul>';
    content +=  '<li>Test Id: ' + this.testInfo.testId + '</li>' + 
                '<li>Report Url: <a href="' + this.testInfo.reportUrl + '">link</a></li>' + 
                '<li>Start Time: ' + this.testInfo.startTime + '</li>' + 
                '<li>Status: ' + this.testInfo.status + '</li>' + 
                '<li>Runs: ' + this.testInfo.runs + '</li>' + 
                '</ul>';
    return content;

}
wpt.prototype.renderHtmlEntry = function(data){
    var content = '<tr>';
    content +=  '<td align="left">' + (data.run || '') + '</td>' +
                '<td id="fvLoadTime">' + (data.loadTime/1000).toFixed(3) + 's</td>' +
                '<td id="fvTTFB">' + (data.TTFB/1000).toFixed(3) + 's</td>' +
                '<td id="fvStartRender">' + (data.render/1000).toFixed(3) + 's</td>' +
                '<td id="fvVisual">' + (data.SpeedIndex?data.SpeedIndex:0).toFixed(2) + '</td>' +
                '<td id="fvDomElements">' + (data.domElements).toFixed(2) + '</td>' +
                '<td id="fvDocComplete" class="border">' + (data.docTime/1000).toFixed(3) + 's</td>' +
                '<td id="fvRequestsDoc">' + (data.requestsDoc || '').toFixed(2)+ '</td>' +
                '<td id="fvBytesDoc">' + data.bytesInDoc.toFixed(2) + ' KB</td>' +
                '<td id="fvFullyLoaded" class="border">' + (data.fullyLoaded/1000).toFixed(3) + 's</td>' +
                '<td id="fvRequests">' + ((data.requests ? data.requests.length : '') || '') + '</td>' +
                '<td id="fvBytes">' + data.bytesIn.toFixed(2) + ' KB</td>';

    content += '</tr>';
return content;
}

wpt.prototype.renderHtmlResult = function(data){
    if(!data || !data.runs) return '';
    var content = '',
        tableheader = '<tr> <th class="" style="border:1px white solid;" colspan="5">' + this.config.testurl + '</th> <th class="empty" colspan="1"></th> <th class="border" colspan="3">Document Complete</th> <th class="border" colspan="3">Fully Loaded</th></tr>'+
                      '<tr> <th>Run</th> <th>Load Time</th> <th>First Byte</th> <th>Start Render</th> <th><a href="https://sites.google.com/a/webpagetest.org/docs/using-webpagetest/metrics/speed-index" target="_blank">Speed Index</a></th> <th>DOM Elements</th> <th class="border">Time</th> <th>Requests</th> <th>Bytes In</th> <th class="border">Time</th> <th>Requests</th> <th>Bytes In</th> </tr>',
        labels = [''];
    content += '<table class="pretty">'
    content += tableheader;
    for (var i = 0; i < data.successfulFVRuns; i++) {
        var item = data.runs[(i+1).toString()].firstView;
        content += this.renderHtmlEntry(item);
    }
    data.average.firstView.run = 'Average';
    this.objResult.summary = this.renderHtmlEntry(data.average.firstView);
    content += this.objResult.summary;
    data.median.firstView.run = 'Median';
    content += this.renderHtmlEntry(data.median.firstView);
    content += '</table>';
    content += '<hr>';
    return content;
};

/* Test set */
var exampleRunResponse = {"statusCode":200,"statusText":"Ok","data":{"testId":"140211_X6_2J8","ownerKey":"c8d71b4eb0351bbeb108926533167e8cf7560db6","jsonUrl":"http://www.webpagetest.org/jsonResult.php?test=140211_X6_2J8","xmlUrl":"http://www.webpagetest.org/xmlResult/140211_X6_2J8/","userUrl":"http://www.webpagetest.org/result/140211_X6_2J8/","summaryCSV":"http://www.webpagetest.org/result/140211_X6_2J8/page_data.csv","detailCSV":"http://www.webpagetest.org/result/140211_X6_2J8/requests.csv"}},
	exampleIncompleteResponse,
	exampleResultResponse_1,
	exampleResultResponse_2;

function getJson (paramName, fileName, callback) {
	if(!paramName) {
		paramName = $.getJSON(fileName, function(json) {
			paramName = json;
			callback(paramName);
		})
	}
	else {
		callback(paramName);
	}
}
function getExampleResultResponse_1 (callback) {
	getJson(exampleResultResponse_1, "/json/exampleResultResponse_run3_1.json", callback);
}
function getExampleResultResponse_2 (callback) {
	getJson(exampleResultResponse_2, "/json/exampleResultResponse_run3_2.json", callback);
}
function getExampleIncompleteResponse (callback) {
	getJson(exampleIncompleteResponse, "/json/exampleIncompleteResponse.json", callback);
}
function getExampleResultResponse_failed (callback) {
	getJson(exampleResultResponse_failed, "/json/exampleResultResponse_run3_failed.json", callback);
}
/* End of Test set */