import * as core from '@actions/core'
import {
  initClient,
  uploadPath,
  pinByCid,
  publishIpns,
  setupWebsite,
  removePrevious
} from './pinner.js'

export async function run(): Promise<void> {
  try {
    const apiKey = core.getInput('api-key', { required: true })
    core.setSecret(apiKey)
    const inputPath = core.getInput('path')
    const cid = core.getInput('cid')
    const endpoint = core.getInput('endpoint') || 'https://ipfs.pinner.xyz'
    const ipnsKey = core.getInput('ipns-key')
    const domain = core.getInput('domain')
    const removePrev = core.getInput('remove-previous') === 'true'

    if (!inputPath && !cid) {
      throw new Error('Either "path" or "cid" input must be provided')
    }

    if (removePrev && !ipnsKey && !domain) {
      throw new Error(
        '"remove-previous" requires "ipns-key" or "domain" to identify the old pin'
      )
    }

    const pinner = initClient(apiKey, endpoint)

    let resultCid: string
    if (inputPath) {
      core.info(`Uploading path: ${inputPath}`)
      resultCid = await uploadPath(pinner, inputPath)
    } else {
      core.info(`Pinning CID: ${cid}`)
      resultCid = await pinByCid(pinner, cid!)
    }

    core.info(`Content CID: ${resultCid}`)

    if (ipnsKey) {
      core.info(`Publishing to IPNS key: ${ipnsKey}`)
      const ipnsName = await publishIpns(pinner, resultCid, ipnsKey)
      core.setOutput('ipns-name', ipnsName)
    }

    if (domain) {
      core.info(`Setting up website for domain: ${domain}`)
      const websiteId = await setupWebsite(pinner, resultCid, domain)
      core.setOutput('website-id', websiteId)
    }

    if (removePrev && (ipnsKey || domain)) {
      core.info('Removing previous pin...')
      try {
        await removePrevious(pinner, resultCid, { ipnsKey, domain })
      } catch (err) {
        core.warning(
          `Failed to remove previous pin: ${err instanceof Error ? err.message : String(err)}`
        )
      }
    }

    const gatewayUrl = `https://dweb.link/ipfs/${resultCid}`
    core.setOutput('cid', resultCid)
    core.setOutput('gateway-url', gatewayUrl)

    core.summary.addHeading('IPFS Deploy Summary')
    core.summary.addRaw('| | |\n|---|---|\n')
    core.summary.addRaw(`| CID | \`${resultCid}\` |\n`)
    core.summary.addRaw(`| Gateway URL | ${gatewayUrl} |\n`)
    if (ipnsKey) {
      core.summary.addRaw(`| IPNS Key | \`${ipnsKey}\` |\n`)
    }
    if (domain) {
      core.summary.addRaw(`| Domain | \`${domain}\` |\n`)
    }
    await core.summary.write()
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message)
    } else {
      core.setFailed('An unexpected error occurred')
    }
  } finally {
    process.exit(0)
  }
}
