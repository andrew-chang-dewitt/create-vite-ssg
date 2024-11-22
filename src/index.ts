import { cp, glob, mkdir, readFile, readdir, rm, writeFile } from "fs/promises"
import { input } from "@inquirer/prompts"
import logger from "loglevel"
import { parse, resolve } from "path"

import { parseArgs } from "./arg-dedupe.js"
import { dir } from "./utils.js"

const __dirname = import.meta.dirname
const CWD = process.cwd()
const CWD_NAME = parse(CWD).base

const HELP_MESSAGE = `\
Usage: create-vite-ssg [DIRECTORY]

Create a new static site project in DIRECTORY using \`vite-plugin-static-md\`.
With no arguments, start the CLI in interactive mode.

Options:
  -v, --verbosity INT           set log output level as number from 0 to 5
                                (inclusive) where lower is less verbose & higher
                                is more & where 0<=n<=5; default value is 2;
                                can give number as number of flags: \`-vvv\` => 3
  -o, --overwrite               overwrite the contents of the DIRECTORY given,
                                if it already exists
  -h, --help                    display this message
`
// Options to add:
//   -t, --template NAME        use a specific template

const { TRACE, DEBUG, INFO, WARN, ERROR } = logger.levels
const levelsArray = [TRACE, DEBUG, INFO, WARN, ERROR]

interface Args {
  help: boolean
  overwrite: boolean
  verbose: number
  _: string[]
}

// FIXME: annotate return type?
async function init() {
  // parse args
  const args = parseArgs<Args>(process.argv.slice(2), ["v", "verbose"], {
    default: { help: false, overwrite: false, verbose: 2 },
    alias: { h: "help", o: "overwrite", v: "verbose" },
    string: ["_"],
  })

  // setup logger from verbosity opt
  // values lower than 0 are 0
  if (0 >= args.verbose) {
    args.verbose = 0
  }
  // values higher than 5 are 5
  if (5 <= args.verbose) {
    args.verbose = 5
  }
  logger.setLevel(levelsArray[args.verbose])
  logger.debug(`log level set to: ${logger.getLevel()}`)

  logger.debug("init() called with args:")
  logger.debug(dir(args))

  // if help option, display message & exit immediately
  if (args.help) {
    // skip logger so this always prints
    process.stdout.write(HELP_MESSAGE)
    return
  }

  // get target directory from cli invocation or default to process cwd
  const targetArg = args._[0] && resolve(args._[0].trim().replace(/\/+$/g, ""))

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
  logger.info(`templateDir: ${templateDir}`)

  // then scaffold from template into target directory
  logger.info(`\nScaffolding project in ${targetDir}...\n`)
  // prepare target directory
  await prepareDirectory(targetDir, args.overwrite || false)
  // then begin by copying the template files
  await cp(templateDir, targetDir, { recursive: true })
  logger.info("...Created files:")
  for await (const f of glob(`${targetDir}/**/*`)) {
    logger.info(`    ${name}${f.slice(targetDir.length)}`)
  }

  // then by updating the package.json with the given project name
  logger.info("\n...Setting up package.json")
  const pkgPath = resolve(targetDir, "package.json")
  const pkg = JSON.parse(await readFile(pkgPath, { encoding: "utf8" }))
  pkg.name = name
  await writeFile(pkgPath, JSON.stringify(pkg, null, 2), {
    encoding: "utf8",
  })

  logger.info("\nDone. Now run:\n")
  if (CWD !== targetDir) logger.info(`  cd ${name}`)
  logger.info("  npm install")
  logger.info("  npm run dev")
}

async function prepareDirectory(
  target: string,
  overwrite: boolean,
): Promise<void> {
  logger.info(`...Preparing project directory at ${target}`)
  try {
    // first, check if the directory exists
    await readdir(target)
    logger.info("...Directory already exists")
    // if it does & overwrite is enabled, delete it, then recreate it
    if (overwrite) {
      logger.warn(`...Overwrite was set to ${overwrite}, clearing directory`)
      await rm(target, { recursive: true, force: true })
      await mkdir(target, { recursive: true })
    }
    // otherwise do nothing, directory is already prepared
    logger.info("...Directory is ready")
  } catch (e: any) {
    // if directory doesn't exist when attempting to read it above, create it
    if (e.code === "ENOENT") {
      logger.info("...Directory doesn't exist yet, creating new directory")
      await mkdir(target, { recursive: true })
      // explicit return to allow throwing later in the catch block
      // for any unhandled errors
      return
    }
    // otherwise, bubble up the error
    logger.warn(
      "...Unhandled error encountered while preparing directory, propagating upward...",
    )
    throw e
  }
}

init().catch(logger.error)
