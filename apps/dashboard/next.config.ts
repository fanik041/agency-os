import type { NextConfig } from 'next'
const config: NextConfig = {
  transpilePackages: ['@agency-os/db', '@agency-os/ui'],
}
export default config
