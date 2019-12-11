
var CT = require('./modules/country-list');
var AM = require('./modules/account-manager');
var EM = require('./modules/email-dispatcher');

module.exports = function(app) {

/*
	login & logout
*/

	app.get('/', function(req, res){
	// check if the user has an auto login key saved in a cookie //
		if (req.cookies.login == undefined){
			res.render('login.pug', { title: 'Hello - Please Login To Your Account' });
		}	else{
	// attempt automatic login //
			AM.validateLoginKey(req.cookies.login, req.ip, function(e, o){
				if (o){
					AM.autoLogin(o.user, o.pass, function(o){
						req.session.user = o;
						res.redirect('/map');
					});
				}	else{
					res.render('login.pug', { title: 'Hello - Please Login To Your Account' });
				}
			});
		}
	});

	app.post('/', function(req, res){
		AM.manualLogin(req.body['user'], req.body['pass'], function(e, o){
			if (!o){
				res.status(400).send(e);
			}	else{
				req.session.user = o;
				if (req.body['remember-me'] == 'false'){
					res.status(200).send(o);
				}	else{
					AM.generateLoginKey(o.user, req.ip, function(key){
						res.cookie('login', key, { maxAge: 900000 });
						res.status(200).send(o);
					});
				}
			}
		});
	});

	app.get('/map', async(req, res) =>{
		if (req.session.user == null){
			res.redirect('/');
		}	else{
			//console.log("load map page");
			//console.log(req.session.user);
			await new Promise(
				(resolve, reject) => {
					AM.checkUser(req.session.user.name, function(e, o){
						//console.log("checked for user test");
						if (!o){
							res.status(400).send(e);
							console.log("error", e);
							resolve();
						}	else{
							req.session.user = o;
							//console.log("user updated");
							resolve();
							//res.status(200).send(o);
						}
					})
				}
			);
			//console.log("updated user");
			//console.log(req.session.user);

			res.render('map.ejs', {
	  		title: 'Map',
				udata : req.session.user
			});
		}

	});

	app.get('/logout', function(req, res){
		res.clearCookie('login');
		req.session.destroy(function(e){ res.status(200).send('ok'); });
		res.redirect('/');
	})

/*
	control panel
*/

	app.get('/home', function(req, res) {
		if (req.session.user == null){
			res.redirect('/');
		}	else{
			res.render('home.pug', {
				title : 'Control Panel',
				countries : CT,
				udata : req.session.user
			});
		}
	});

	app.post('/home', function(req, res){
		if (req.session.user == null){
			res.redirect('/');
		}	else{
			AM.updateAccount({
				id		: req.session.user._id,
				name	: req.body['name'],
				email	: req.body['email'],
				pass	: req.body['pass'],
				country	: req.body['country']
			}, function(e, o){
				if (e){
					res.status(400).send('error-updating-account');
				}	else{
					req.session.user = o.value;
					res.status(200).send('ok');
				}
			});
		}
	});

/*
	new accounts
*/

	app.get('/signup', function(req, res) {
		res.render('signup.pug', {  title: 'Signup', countries : CT });
	});

	app.post('/signup', function(req, res){
		AM.addNewAccount({
			name 	: req.body['name'],
			email 	: req.body['email'],
			user 	: req.body['user'],
			pass	: req.body['pass'],
			country : req.body['country']
		}, function(e){
			if (e){
				res.status(400).send(e);
			}	else{
				res.status(200).send('ok');
			}
		});
	});

/*
	password reset
*/

	app.post('/lost-password', function(req, res){
		let email = req.body['email'];
		AM.generatePasswordKey(email, req.ip, function(e, account){
			if (e){
				res.status(400).send(e);
			}	else{
				EM.dispatchResetPasswordLink(account, function(e, m){
			// TODO this callback takes a moment to return, add a loader to give user feedback //
					if (!e){
						res.status(200).send('ok');
					}	else{
						for (k in e) console.log('ERROR : ', k, e[k]);
						res.status(400).send('unable to dispatch password reset');
					}
				});
			}
		});
	});

	app.get('/reset-password', function(req, res) {
		AM.validatePasswordKey(req.query['key'], req.ip, function(e, o){
			if (e || o == null){
				res.redirect('/');
			} else{
				req.session.passKey = req.query['key'];
				res.render('reset.pug', { title : 'Reset Password' });
			}
		})
	});

	app.post('/reset-password', function(req, res) {
		let newPass = req.body['pass'];
		let passKey = req.session.passKey;
	// destory the session immediately after retrieving the stored passkey //
		req.session.destroy();
		AM.updatePassword(passKey, newPass, function(e, o){
			if (o){
				res.status(200).send('ok');
			}	else{
				res.status(400).send('unable to update password');
			}
		})
	});

/*
	view, delete & reset accounts
*/

	app.get('/print', function(req, res) {
		AM.getAllRecords( function(e, accounts){
			res.render('print.pug', { title : 'Account List', accts : accounts });
		})
	});

	app.post('/delete', function(req, res){
		AM.deleteAccount(req.session.user._id, function(e, obj){
			if (!e){
				res.clearCookie('login');
				req.session.destroy(function(e){ res.status(200).send('ok'); });
			}	else{
				res.status(400).send('record not found');
			}
		});
	});

	app.get('/reset', function(req, res) {
		AM.deleteAllAccounts(function(){
			res.redirect('/print');
		});
	});

	app.get('*', function(req, res) { res.render('404.pug', { title: 'Page Not Found'}); });

};
