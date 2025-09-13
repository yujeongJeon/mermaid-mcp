import {exec} from 'child_process'
import {promisify} from 'util'

const execAsync = promisify(exec)

export const isGitInstalled = async () => {
    try {
        await execAsync('git --version')
        return true
    } catch {
        return false
    }
}

export const getProjectRoot = async () => {
    if (!(await isGitInstalled())) {
        throw new Error('Git is not installed or not available in PATH. Please specify projectPath manually.')
    }
    const {stdout} = await execAsync('git rev-parse --show-toplevel')
    return stdout.trim()
}
