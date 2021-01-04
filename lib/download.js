const download = require('download-git-repo')
const path = require('path')
const ora = require('ora')

module.exports = function (target) {
    target = path.join(target || '.', '.download-temp');
    return new Promise((res, rej) => {
        let url = 'qiaohe12/react-cli-tpl#master'
        const spinner = ora(`正在下载项目模板...`)
        spinner.start()
        download(url, target, { clone: false }, err => {
            if (err) {
                spinner.fail()
                rej(err)
            } else {
                spinner.succeed()
                res(target)
            }
        })
    })
}
