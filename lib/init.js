const  { promisify } = require('util')
const { Command } = require('commander') // 定义全局对象program
const chalk = require('chalk') // 颜色插件
const validateProjectName = require('validate-npm-package-name') // 检查npm包的名字
const fs = require('fs-extra') // 文件信息
const path = require('path')
const CFonts = require('cfonts') // 样式
const inquirer = require('inquirer') // 用户与命令行的交互
const logSymbols = require('log-symbols')
const spawn = require('cross-spawn')
const Metalsmith = require('metalsmith')
const Handlebars = require('handlebars')
const packageJson = require('../package.json')
const download = require('./download')




function init() {
  const program = new Command(packageJson.name)
                  .usage('<program-name>')
                  .parse(process.argv)
  const projectName = program.args[0]
  if (typeof projectName === 'undefined') {
    console.error('Please specify the project directory:')
    console.log(
      `${chalk.cyan(program.name())} ${chalk.green('<project-directory>')}`
    )
    console.log('For exzample:')
    console.log(`${chalk.cyan(program.name())} ${chalk.green('my-app')}`)
    process.exit(1)
  }
  createApp(projectName)
}

function createApp(name) {
  // 检查项目名称是否符合npm要求
  checkAppName(name)
  // 确保文件是否存在，如果没有就创建
  fs.ensureDirSync(name)

  const root = path.resolve(name);
  // 判断当前文件夹下是否存在冲突文件
  isSafeToCreateProjectIn(root, name)

  CFonts.say(name, {
    font: 'simple',
    align: 'left',
    background: 'transparent',
    letterSpacing: 1,
    lineHeight: 1,
    space: true,
    maxLength: '0',
  })

  // 项目模板下载
  downloadTemplete(name)

}

function checkAppName(name) {
  const validateResult = validateProjectName(name)
  if (!validateResult) {
    console.error(
      chalk.red(
          `Cannot create a project named ${chalk.green(appName)} because of npm naming restrictions:\n`
      )
    );
    [
        ...(validateResult.errors || []),
        ...(validateResult.warnings || [])
    ].forEach(err => (
        console.error(chalk.red(` *${error}`))
    ))
    console.error(chalk.red('\nPlease choose a different project name.'))
    process.exit(1)
  }
  const dependendies = ['react', 'react-dom']
  if (dependendies.includes(name)) {
    console.error(
      chalk.red(
        `Cannot create a project named ${chalk.green(name)} because a dependency with a same name exists.`
      )
    )
    process.exit(1)
  }
}

function isSafeToCreateProjectIn(root, name) {
  // 文件夹下允许存在的文件
  const validFiles = [
    '.DS_Store',
    '.git',
    '.gitattributes',
    '.gitignore',
    '.gitlab-ci.yml',
    '.hg',
    '.hgcheck',
    '.hgignore',
    '.idea',
    '.npmignore',
    '.travis.yml',
    'docs',
    'LICENSE',
    'README.md',
    'mkdocs.yml',
    'Thumbs.db'
  ]
  const conflicts = fs.readdirSync(root).filter(file => !validFiles.includes(file))
  if (conflicts && conflicts.length) {
      console.log(`The directory ${chalk.green(name)} contains files that could conflict:`)
      console.log()
      for (const file of conflicts) {
          try {
              const stats = fs.lstatSync(path.join(root, file))
              if (stats.isDirectory()) {
                  console.log(` ${chalk.blue(`${file}/`)}`);
              } else {
                  console.log(` ${file}`)
              }
          } catch (e) {
              console.log(` ${file}`)
          }
      }
      console.log()
      console.log('Either try using a new directory name, or remove the files listed above.')
      process.exit(1)
  }
}

function downloadTemplete(name) {
  inquirer.prompt(
    [
      {
        name: 'name',
        message: '项目名称',
        default: name
      },
      {
        name: 'projectDes',
        message: '项目描述',
        default: `A project named ${name}`
      }
    ]
  ).then(res => {
    return { data: res }
  }).then(context => {
    const { data } = context
    return download(name).then(target => {
      return {
        name,
        downloadTemp: target,
        data
      }
    }).catch(err => console.error(err))
  }).then(context => {
    console.log('生成文件')
    // 删除临时文件夹，将文件移动到目标目录下
    return generator(context)
  }).then(context => {
    console.log(logSymbols.success, chalk.green('创建成功'))
    return inquirer.prompt(
      [
        {
          name: 'install',
          message: '是否安装依赖',
          default: 'yes'
        }
      ]
    ).then(res => {
        let isInstall = res.install.toUpperCase()
        return {
            ...context,
            isInstall: isInstall === 'YES' || isInstall === 'Y'
        }
    })
  }).then(context => {
    if (context.isInstall) {
      return install(name)
    }
    return
  }).then(() => {
    console.log(chalk.green('恭喜，项目已经初始化完成'))
    console.log('你可以执行以下命令运行开发环境')
    console.log(chalk.green(` cd ${name}       `));
    console.log(chalk.green(` npm start`));
  }).catch(err => {
    console.error('err')
    console.error(logSymbols.error, chalk.red(`创建失败：${err.message}`))
  })
}

function generator(context) {
  let metadata = context.data; // 用户自定义信息
  let src = context.downloadTemp; // 暂时存放文件目录
  let dest = `./${context.name}`; //项目的根目录
  if (!src) {
    return new Promise(
      new Error(`无效的source:${src}`)
    )
  }
  return new Promise((resolve, reject) => {
    const metalsmith = Metalsmith(process.cwd())
    .metadata(metadata) // 将用户输入信息放入
    .clean(false)
    .source(src)
    .destination(dest);
    metalsmith.use((files, metalsmith, done) => {
        const meta = metalsmith.metadata()
        Object.keys(files).forEach(fileName => {
            if (fileName.split('.').pop() !== 'ico') {
                const t = files[fileName].contents.toString()
                files[fileName].contents = new Buffer.from(Handlebars.compile(t)(meta), 'UTF-8')
            }
        })
        done()
    }).build(err => {
        err && console.log(err)
        removeDir(src);
        err ? reject(err) : resolve(context);
    })
  })
}

function removeDir(dir) {
  let files = fs.readdirSync(dir)
  for (var i = 0; i < files.length; i++) {
      let newPath = path.join(dir, files[i]);
      let stat = fs.statSync(newPath)
      if (stat.isDirectory()) {
          //如果是文件夹就递归下去
          removeDir(newPath);
      } else {
          //删除文件
          fs.unlinkSync(newPath);
      }
  }
  fs.rmdirSync(dir)//如果文件夹是空的，就将自己删除掉
}

function install (name) {
  const currentPath = process.cwd()
  const command = 'npm'
  const args = ['install']
  const child = spawn(
      command,
      args,
      {
          stdio: 'inherit',
          cwd: path.join(currentPath, name)
      },
  )
  return new Promise((res, rej) => {
      child.on('close', code => {
          if (code !== 0) {
              console.error('安装失败')
              process.exit(1)
              rej({
                  command: `${command} ${args.join(' ')}`
              })
              return
          }
          res()
      })
  })
}

module.exports = {
  init
}

// module.exports = async name => {
//   console.log(name)
//   // 打印欢迎界面
//   clear()
//   if (!name) {
//     console.error('Please specify the project directory:')
//     console.log(
//         `${chalk.cyan(program.name())} ${chalk.green('<project-directory>')}`
//     )
//     console.log()
//     console.log('For example:')
//     console.log(` ${chalk.cyan(program.name())} ${chalk.green('my-app')}`);
//     process.exit(1)
//   }
//   // const data = await figlet('webcome hbb')
//   // log(data)
//   log('创建项目' + name)
//   await clone('github:qiaohe12/react-tpl', name)
//   log('安装依赖')
//   await spawn('npm', ['install'], { cwd: `./${name}` })
//   log(`
// 👌安装完成：
// To get Start:
// ===========================
//     cd ${name}
//     npm run serve
// ===========================
//             `)

//     const open = require('open')
//     open('http://localhost:8080')
//     await spawn('npm', ['run', 'serve'], { cwd: `./${name}` })
// }



