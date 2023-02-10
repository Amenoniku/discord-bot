
const { Configuration, OpenAIApi } = require('openai')
const configuration = new Configuration({
  organization: process.env.OPENAI_ORG,
  apiKey: process.env.OPENAI_KEY
})

export const openai = new OpenAIApi(configuration)
