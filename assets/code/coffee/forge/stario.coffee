events = require "events"
EventEmitter = events.EventEmitter

class StarIO extends EventEmitter
  saveUserDetails: (username, password ,cb)->
    if not forge?
      localStorage.setItem "username", username
      localStorage.setItem "password", password
      (cb?();return) 
    forge?.internal.call "stario.saveUserDetails", 
      username: username
      password: password
    , ()->
      cb? null
    , (e)->
      cb? "error", e
  getUserDetails: (cb)->
    if not forge?
      username = localStorage.getItem "username"
      password = localStorage.getItem "password"
      result = 
        username: username
        password: password
      cb? null, result
      return
    # (cb?();return) if not forge?
    forge?.internal.call "stario.getUserDetails", {}, (result)->
      cb? null, result
    , (e)->
      cb? "error", e
  checkStatus: (cb)->
    (cb?("error");return) if not forge?
    forge?.internal.call "stario.checkStatus", {}, (status)->
      cb? null, status
    , (e)->
      cb? "error", e
  printReceipt: (text, cb)->
    (cb?("error");return) if not forge?
    forge?.internal.call "stario.printReceipt", text:text, ()->
      cb? null
    , (e)->
      cb? "error", e
  startHeartbeat: (interval, cb)->
    (cb?("error");return) if not forge?
    forge?.internal.call "stario.startHeartbeat", interval:interval, ()->
      cb? null
    , (e)->
      cb? "error", e
  stopHeartbeat: (text, cb)->
    (cb?("error");return) if not forge?
    forge?.internal.call "stario.stopHeartbeat", {}, ()->
      cb? null
    , (e)->
      cb? "error", e
  constructor: ->
    @startHeartbeat 5000, ->
    forge?.internal.addEventListener "stario.heartbeat", (event, e) =>
      @checkStatus ->
      @emit "stario.heartbeat"

module.exports = new StarIO()