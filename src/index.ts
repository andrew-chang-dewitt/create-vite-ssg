import { input } from "@inquirer/prompts"
import { cp, glob, mkdir, readFile, readdir, rm, writeFile } from "fs/promises"
import minimist from "minimist"
import { parse, resolve } from "path"

const __dirname = import.meta.dirname
const CWD = process.cwd()
const CWD_NAME = parse(CWD).base

const HELP_MESSAGE = `\
Usage: create-vite-ssg [DIRECTORY]

Create a new static site using \`vite-plugin-static-md\`.
With no arguments, start the CLI in interactive mode.`

interface Args {
  help?: boolean
  overwrite?: boolean
}

// FIXME: annotate return type?
async function init() {
  // parse args
  const argv = minimist<Args>(process.argv.slice(2), {
    default: { help: false, overwrite: false },
    alias: { h: "help", o: "overwrite" },
    string: ["_"],
  })

  // if help option, display message & exit immediately
  if (argv.help) {
    console.log(HELP_MESSAGE)
    return
  }

  // get target directory from cli invocation or default to process cwd
  const targetDir = resolve(argv._[0]?.trim().replace(/\/+$/g, "") || CWD)

  // get project name from user input
  const name =
    // either from cli invocation args
    parse(targetDir).base ||
    // or via user prompt
    (await input({
      message: "Project name:",
      default: CWD_NAME,
    }))

  // get template desired
  // TODO: there's only once choice for now
  const template = "template-typescript"
  const templateDir = resolve(__dirname, `../${template}`)

  // prepare target directory
  prepareDirectory(targetDir, argv.overwrite || false)

  // then scaffold from template into target directory
  console.log(`\nScaffolding project in ${targetDir}...\n`)
  // first by copying the template files
  const nocopy = /\/(node_modules|dist)\//
  await cp(templateDir, targetDir, {
    recursive: true,
    filter(source, _) {
      return !nocopy.test(source)
    },
  })
  // then by updating the package.json with the given project name
  const pkgPath = resolve(targetDir, "package.json")
  const pkg = JSON.parse(await readFile(pkgPath, { encoding: "utf8" }))
  pkg.name = name
  await writeFile(pkgPath, JSON.stringify(pkg, null, 2), {
    encoding: "utf8",
  })

  let res = []
  for await (const f of glob(`${targetDir}/**/*`)) {
    res.push(f)
  }

  console.log("\nDone. Now run:\n")
  if (CWD !== targetDir) console.log(`  cd ${name}`)
  console.log("  npm install")
  console.log("  npm run dev")
}

async function prepareDirectory(
  target: string,
  overwrite: boolean,
): Promise<void> {
  try {
    // first, check if the directory exists
    await readdir(target)
    // if it does & overwrite is enabled, delete it, then recreate it
    if (overwrite) {
      await rm(target, { recursive: true, force: true })
      await mkdir(target, { recursive: true })
    }
    // otherwise do nothing, directory is already prepared
  } catch (e: any) {
    // if directory doesn't exist when attempting to read it above, create it
    if (e.code === "ENOENT") {
      await mkdir(target, { recursive: true })
      // explicit return to allow throwing later in the catch block
      // for any unhandled errors
      return
    }
    // otherwise, bubble up the error
    throw e
  }
}

init().catch(console.error).then(console.dir)
