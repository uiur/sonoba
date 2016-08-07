const gitUserName = require('git-user-name')
const fullname = require('fullname')

module.exports = () => {
  let name = gitUserName()
  if (name) {
    return Promise.resolve(name)
  }

  return fullname()
}
