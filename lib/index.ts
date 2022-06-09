import type { default as FastifyCORS, FastifyCorsOptions } from '@fastify/cors'
import type { default as FastifyHelmet } from '@fastify/helmet'
import type { default as FastifyJWT } from '@fastify/jwt'
import type { default as FastifyMongoDB } from '@fastify/mongodb'
import type { default as FastifSwagger } from '@fastify/swagger'
import type { default as UnderPressure } from '@fastify/under-pressure'
import * as crypto from 'crypto'
import type { default as EnvSchema, EnvSchemaData, EnvSchemaOpt } from 'env-schema'
import { FastifyPluginAsync, FastifyPluginCallback, FastifyRegisterOptions } from 'fastify'
import FastifyPlugin from 'fastify-plugin'
import * as fs from 'fs'
import * as path from 'path'

function requireOptionalDependency<T> (name: string): T | false {
  try {
    return require(name)
  } catch {
    return false
  }
}

function checkEnable<T> (option?: boolean | T): boolean {
  return option === true || (typeof option === 'object' && option !== null && !Array.isArray(option)) || typeof option === 'function'
}

function parseOption<T> (option: boolean | T, def: T): T {
  if (option === true) {
    return def
  } else if (option === false) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return {} as T
  } else if (typeof option === 'function') {
    return option()
  } else {
    return option
  }
}

type ExtractGeneric<T> = T extends FastifyPluginCallback<infer X> ? X : T extends FastifyPluginAsync<infer Y> ? Y : never

export interface FastifyPackedOption {
  env?: boolean | EnvSchemaOpt
  cors?: boolean | FastifyRegisterOptions<FastifyCorsOptions>
  helmet?: boolean | FastifyRegisterOptions<ExtractGeneric<typeof FastifyHelmet>>
  underPressure?: boolean | FastifyRegisterOptions<ExtractGeneric<typeof UnderPressure>>

  jwt?: boolean | FastifyRegisterOptions<ExtractGeneric<typeof FastifyJWT>>
  mongodb?: boolean | FastifyRegisterOptions<ExtractGeneric<typeof FastifyMongoDB>>
  swagger?: boolean | FastifyRegisterOptions<ExtractGeneric<typeof FastifSwagger>>
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

export interface CreatedPackedPlugin {
  plugin: FastifyPluginAsync<FastifyPackedOption>
  version: () => string
  env: EnvSchemaData
}

export function createPackedPlugin (envOptions?: true | EnvSchemaOpt): CreatedPackedPlugin {
  // environment variables
  let env: EnvSchemaData = {}
  if (checkEnable(envOptions)) {
    const envSchema = requireOptionalDependency<typeof EnvSchema>('env-schema')
    if (envSchema === false) throw Error('please install env-schema with the following command:\nnpm install env-schema\nyarn add env-schema')
    const opt = parseOption(envOptions, { })
    env = envSchema(opt)
  }

  return {
    plugin: FastifyPlugin(createPacked(), {
      fastify: '3.x',
      name: 'fastify-packed',
      dependencies: []
    }),
    version,
    env
  }
}

const createPacked = function (): FastifyPluginAsync<FastifyPackedOption> {
  return async function Packed (fastify, options) {
    options = options ?? {}

    // environment variables
    if (checkEnable(options.env)) {
      const envSchema = requireOptionalDependency<typeof EnvSchema>('env-schema')
      if (envSchema === false) throw Error('please install env-schema with the following command:\nnpm install env-schema\nyarn add env-schema')
      const opt = parseOption(options.env, { })
      const env = envSchema(opt)
      await fastify.decorate('config', env)
      await fastify.decorate('VERSION', version())
    }

    // cross-origin resource sharing
    if (checkEnable(options.cors)) {
      const fastifyCORS = requireOptionalDependency<typeof FastifyCORS>('@fastify/cors')
      if (fastifyCORS === false) throw Error('please install @fastify/cors with the following command:\nnpm install @fastify/cors\nyarn add @fastify/cors')
      const opt = parseOption(options.cors, { origin: true })
      await fastify.register(fastifyCORS, opt)
    }

    // swagger should place before helmet
    if (checkEnable(options.swagger)) {
      const fastifySwagger = requireOptionalDependency<typeof FastifSwagger>('@fastify/swagger')
      if (fastifySwagger === false) throw Error('please install @fastify/swagger with the following command:\nnpm install @fastify/swagger\nyarn add @fastify/swagger')
      const opt = parseOption(options.swagger, { })
      await fastify.register(fastifySwagger, opt)
    }

    // security package
    if (checkEnable(options.helmet)) {
      const fastifyHelmet = requireOptionalDependency<typeof FastifyHelmet>('@fastify/helmet')
      if (fastifyHelmet === false) throw Error('please install @fastify/helmet with the following command:\nnpm install @fastify/helmet\nyarn add @fastify/helmet')
      const opt = parseOption(options.helmet, { contentSecurityPolicy: fastifyHelmet.contentSecurityPolicy.getDefaultDirectives() })
      await fastify.register(fastifyHelmet, opt)
    }

    // rate limit
    if (checkEnable(options.underPressure)) {
      const underPressure = requireOptionalDependency<typeof UnderPressure>('under-pressure')
      if (underPressure === false) throw Error('please install under-pressure with the following command:\nnpm install under-pressure\nyarn add under-pressure')
      const opt = parseOption(options.underPressure, {
        maxEventLoopDelay: 1000,
        message: 'System is under pressure, please try again later.',
        retryAfter: 50,
        exposeStatusRoute: true
      })
      await fastify.register(underPressure, opt)
    }

    // jwt instance
    if (checkEnable(options.jwt)) {
      const fastifyJWT = requireOptionalDependency<typeof FastifyJWT>('@fastify/jwt')
      if (fastifyJWT === false) throw Error('please install @fastify/jwt with the following command:\nnpm install @fastify/jwt\nyarn add @fastify/jwt')
      const opt = parseOption(options.jwt, { secret: crypto.randomBytes(8).toString('hex') })
      await fastify.register(fastifyJWT, opt)
    }

    // mongodb instance
    if (checkEnable(options.mongodb)) {
      const fastifyMongoDB = requireOptionalDependency<typeof FastifyMongoDB>('@fastify/mongodb')
      if (fastifyMongoDB === false) throw Error('please install @fastify/mongodb with the following command:\nnpm install @fastify/mongodb\nyarn add @fastify/mongodb')
      const opt = parseOption(options.mongodb, { url: 'mongodb://127.0.0.1:27017', database: 'default' })
      await fastify.register(fastifyMongoDB, opt)
    }
  }
}

export const FastifyPacked = FastifyPlugin(createPacked(), {
  fastify: '4.x',
  name: '@kakang/fastify-packed',
  dependencies: []
})

export default FastifyPacked
