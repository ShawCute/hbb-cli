#!/usr/bin/env node
// 指定解释器
const program = require('commander')
const chalk = require('chalk')

// 判断当前node版本，如果node版本<10，则提示用户，并退出程序
const currentNodeVersion = process.versions.node.split('.')[0]
if (currentNodeVersion < 10) {
	console.error(
		chalk.red(`You are running Node ${currentNodeVersion}. \nhbb requires Node 10 or higher. \nPlease update your versions of node`)
	)
	// 退出进程
	process.exit(1)
}

// 命令
// program.version(require('../package.json').version)

// program.command('init <name>')
//         .description('init project')
//         .action(require('../lib/init'))

// program.parse(process.argv)

const { init } = require('../lib/init')
init();