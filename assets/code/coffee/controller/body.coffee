Kinvey = require "../lib/kinvey"
StarIO = require "../forge/stario"

class BodyCtrl
  constructor: (@scope)->
    $.extend @scope, @
    @scope.page = 'login'
    StarIO.getUserDetails (err, result)=>
      if result?.username and result?.password
        @scope.username = result.username
        @scope.password = result.password
        @login()
  login:=>
    user = new Kinvey.User()
    user.login @scope.username, @scope.password,
      success:=>
        StarIO.saveUserDetails @scope.username, @scope.password
        @scope.password = ""
        @scope.page='home'
        @scope.loggedIn = true
        @scope.$apply()
      error:=>
        @scope.password = ""
        @scope.error="There is an error logging you in. Please try again."
        @scope.$apply()
  logout  :=>
    StarIO.saveUserDetails "",""
    @scope.username = ""
    @scope.password = ""
    @scope.page='login'
    @scope.loggedIn =false     

BodyCtrl.$inject = ["$scope"]
app.controller("BodyCtrl", BodyCtrl)
