import { registerOTel } from '@vercel/otel'
import { AISDKExporter } from 'langsmith/vercel'

export function register() {
  registerOTel({
    serviceName: 'lawgic-nextjs',
    traceExporter: new AISDKExporter(),
  })
}
