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
  verbose?: number
}

// FIXME: annotate return type?
async function init() {
  // parse args
  const argv = minimist<Args>(process.argv.slice(2), {
    default: { help: false, overwrite: false, verbose: 1 },
    alias: { h: "help", o: "overwrite", v: "verbose" },
    string: ["_"],
  })

  // if help option, display message & exit immediately
  if (argv.help) {
    console.log(HELP_MESSAGE)
    return
  }

  // get target directory from cli invocation or default to process cwd
  const targetArg = argv._[0] && resolve(argv._[0].trim().replace(/\/+$/g, ""))

  // get project name from user input
  const name =
    // either from cli invocation args
    (targetArg && parse(targetArg).base) ||
    // or via user prompt
    (await input({
      message: "Project name:",
      default: CWD_NAME,
    }))
  // now if targetDir was undefined, use given name to define it
  const targetDir = name === CWD_NAME ? CWD : resolve(CWD, name)

  // get template desired
  // TODO: there's only once choice for now
  const template = "template-typescript"
  const templateDir = resolve(__dirname, `../${template}`)
  console.log(`templateDir: ${templateDir}`)

  // then scaffold from template into target directory
  console.log(`\nScaffolding project in ${targetDir}...\n`)
  // prepare target directory
  await prepareDirectory(targetDir, argv.overwrite || false)
  // then begin by copying the template files
  await cp(templateDir, targetDir, { recursive: true })
  console.log("...Copied files:")
  for await (const f of glob(`${targetDir}/**/*`)) {
    console.dir(f)
  }

  // then by updating the package.json with the given project name
  console.log("...Setting up package.json")
  const pkgPath = resolve(targetDir, "package.json")
  const pkg = JSON.parse(await readFile(pkgPath, { encoding: "utf8" }))
  pkg.name = name
  await writeFile(pkgPath, JSON.stringify(pkg, null, 2), {
    encoding: "utf8",
  })

  console.log("\nDone. Now run:\n")
  if (CWD !== targetDir) console.log(`  cd ${name}`)
  console.log("  npm install")
  console.log("  npm run dev")
}

async function prepareDirectory(
  target: string,
  overwrite: boolean,
): Promise<void> {
  console.log(`...Preparing project directory at ${target}`)
  try {
    // first, check if the directory exists
    await readdir(target)
    console.log("...Directory already exists")
    // if it does & overwrite is enabled, delete it, then recreate it
    if (overwrite) {
      console.warn(`...Overwrite was set to ${overwrite}, clearing directory`)
      await rm(target, { recursive: true, force: true })
      await mkdir(target, { recursive: true })
    }
    // otherwise do nothing, directory is already prepared
    console.log("...Directory is ready")
  } catch (e: any) {
    // if directory doesn't exist when attempting to read it above, create it
    if (e.code === "ENOENT") {
      console.log("...Directory doesn't exist yet, creating new directory")
      await mkdir(target, { recursive: true })
      // explicit return to allow throwing later in the catch block
      // for any unhandled errors
      return
    }
    // otherwise, bubble up the error
    console.warn(
      "...Unhandled error encountered while preparing directory, propagating upward...",
    )
    throw e
  }
}

init().catch(console.error)
