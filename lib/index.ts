import * as crypto from 'crypto'
import type { default as EnvSchema, EnvSchemaData, EnvSchemaOpt } from 'env-schema'
import { FastifyPluginAsync, FastifyPluginCallback, FastifyRegisterOptions } from 'fastify'
import type { default as FastifyCORS, FastifyCorsOptions } from 'fastify-cors'
import type { default as FastifyHelmet } from 'fastify-helmet'
import type { default as FastifyJWT } from 'fastify-jwt'
import type { default as FastifyMongoDB } from 'fastify-mongodb'
import FastifyPlugin from 'fastify-plugin'
import type { default as FastifSwagger } from 'fastify-swagger'
import * as fs from 'fs'
import * as path from 'path'
import type { default as UnderPressure } from 'under-pressure'

function requireOptionalDependency<T> (name: string): T | false {
  try {
    return require(name)
  } catch {
    return false
  }
}

function checkEnable<T> (option?: true | T): boolean {
  return option === true || (typeof option === 'object' && option !== null && !Array.isArray(option)) || typeof option === 'function'
}

function parseOption<T> (option: true | T, def: T): T {
  if (option === true) {
    return def
  } else if (typeof option === 'function') {
    return option()
  } else {
    return option
  }
}

type ExtractGeneric<T> = T extends FastifyPluginCallback<infer X> ? X : T extends FastifyPluginAsync<infer Y> ? Y : never

export interface FastifyPackedOption extends Object {
  env?: true | EnvSchemaOpt
  cors?: true | FastifyRegisterOptions<FastifyCorsOptions>
  helmet?: true | FastifyRegisterOptions<ExtractGeneric<typeof FastifyHelmet>>
  underPressure?: true | FastifyRegisterOptions<ExtractGeneric<typeof UnderPressure>>

  jwt?: FastifyRegisterOptions<ExtractGeneric<typeof FastifyJWT>>
  mongodb?: FastifyRegisterOptions<ExtractGeneric<typeof FastifyMongoDB>>
  swagger?: FastifyRegisterOptions<ExtractGeneric<typeof FastifSwagger>>
}

export function version (): string {
  try {
    const pkg = fs.readFileSync(path.resolve('./package.json'))
    return JSON.parse(String(pkg)).version
  } catch {
    return process.version
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    VERSION: string
  }
}

export function createPackedPlugin (envOptions?: true | EnvSchemaOpt): {
  plugin: FastifyPluginAsync<FastifyPackedOption>
  version: () => string
  env: EnvSchemaData
} {
  // environment variables
  let env: EnvSchemaData = {}
  const envSchema = requireOptionalDependency<typeof EnvSchema>('env-schema')
  if (envSchema !== false && checkEnable(envOptions)) {
    const opt = parseOption(envOptions, { })
    env = envSchema(opt)
  }

  return {
    plugin: FastifyPlugin(Packed, {
      fastify: '3.x',
      name: 'fastify-packed',
      dependencies: []
    }),
    version,
    env
  }
}

const Packed: FastifyPluginAsync<FastifyPackedOption> = async function (fastify, options) {
  options = options ?? {}

  // environment variables
  const envSchema = requireOptionalDependency<typeof EnvSchema>('env-schema')
  if (envSchema !== false && checkEnable(options.env)) {
    const opt = parseOption(options.env, { })
    const env = envSchema(opt)
    await fastify.decorate('config', env)
    await fastify.decorate('VERSION', version())
  }

  // cross-origin resource sharing
  const fastifyCORS = requireOptionalDependency<typeof FastifyCORS>('fastify-cors')
  if (fastifyCORS !== false && checkEnable(options.cors)) {
    const opt = parseOption(options.cors, { origin: true })
    await fastify.register(fastifyCORS, opt)
  }

  // swagger should place before helmet
  const fastifySwagger = requireOptionalDependency<typeof FastifyCORS>('fastify-swagger')
  if (fastifySwagger !== false && checkEnable(options.swagger)) {
    const opt = parseOption(options.swagger, { })
    await fastify.register(fastifySwagger, opt)
  }

  // security package
  const fastifyHelmet = requireOptionalDependency<typeof FastifyHelmet>('fastify-helmet')
  if (fastifyHelmet !== false && checkEnable(options.helmet)) {
    const opt = parseOption(options.helmet, { contentSecurityPolicy: fastifyHelmet.contentSecurityPolicy.getDefaultDirectives() })
    await fastify.register(fastifyHelmet, opt)
  }

  // rate limit
  const underPressure = requireOptionalDependency<typeof UnderPressure>('under-pressure')
  if (underPressure !== false && checkEnable(options.underPressure)) {
    const opt = parseOption(options.underPressure, {
      maxEventLoopDelay: 1000,
      message: 'System is under pressure, please try again later.',
      retryAfter: 50,
      exposeStatusRoute: true
    })
    await fastify.register(underPressure, opt)
  }

  // jwt instance
  const fastifyJWT = requireOptionalDependency<typeof FastifyJWT>('fastify-jwt')
  if (fastifyJWT !== false && checkEnable(options.jwt)) {
    const opt = parseOption(options.jwt, { secret: crypto.randomBytes(8).toString('hex') })
    await fastify.register(fastifyJWT, opt)
  }

  // mongodb instance
  const fastifyMongoDB = requireOptionalDependency<typeof FastifyMongoDB>('fastify-mongodb')
  if (fastifyMongoDB !== false && checkEnable(options.mongodb)) {
    const opt = parseOption(options.mongodb, { url: 'mongodb://127.0.0.1:27017', database: 'default' })
    await fastify.register(fastifyMongoDB, opt)
  }
}

export const FastifyPacked = FastifyPlugin(Packed, {
  fastify: '3.x',
  name: '@kakang/fastify-packed',
  dependencies: []
})

export default FastifyPacked
