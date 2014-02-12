
/*
 * GET home page.
 */

exports.index = function(req, res){
  res.render('index', { title: 'Express' });
};
exports.wptTesting = function(req, res){
  res.render('wpt-testing', {  });
};
