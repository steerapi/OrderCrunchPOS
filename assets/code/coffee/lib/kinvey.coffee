# Kinvey.Sync.configure conflict: Kinvey.Sync.clientAlwaysWins

# Configure.
Kinvey.init
  appKey: "kid_TVtkHjI09f"
  appSecret: "d4e76bc9de1b4dd0ba6c2d4f0288de2d"
  # sync: true # Enable offline saving.

Kinvey.User::me = (options)->
  url = @store._getUrl({ id: '_me' })
  @store._send('GET', url, null, options)

module.exports = Kinvey