/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // O tracing do `sharp` em modo standalone (@vercel/nft) é instável nesse
  // deploy — funciona num teste isolado e falha com "Unable to optimize
  // image" no pod real, sem diferença de imagem/ambiente identificável.
  // Assets já são poucos e pequenos (logos do rodapé, avatar do Google que
  // já vem redimensionado); não vale manter a superfície de instabilidade
  // só por isso.
  images: { unoptimized: true },
}

module.exports = nextConfig
