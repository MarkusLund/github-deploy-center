import {
  Button,
  colors,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@material-ui/core'
import { Alert } from '@material-ui/lab'
import { groupBy, keyBy, orderBy, uniq } from 'lodash-es'
import React, { FC } from 'react'
import { useMutation } from 'react-query'
import { DeploymentState } from '../generated/graphql'
import { useActions, useOvermindState } from '../overmind'
import { DeploymentModel, ReleaseModel } from '../overmind/state'
import { useFetchDeployments, useFetchReleases } from './fetchHooks'

const getButtonColor = (state: DeploymentState): string => {
  switch (state) {
    case DeploymentState.Active:
      return colors.blue[400]
    case DeploymentState.Failure:
      return colors.red[400]
    case DeploymentState.Pending:
      return colors.orange[400]
    case DeploymentState.InProgress:
      return colors.yellow[400]
    default:
      return colors.grey[50]
  }
}
const estimateEnvironmentsOrder = (
  deployments: DeploymentModel[] | null | undefined
) => {
  return uniq(
    orderBy(deployments || [], (d) => d.createdAt).map((d) => d.environment)
  )
}
export const ReleasesTableView: FC = () => {
  const { environmentOrderForSelectedRepo } = useOvermindState()
  const { triggerDeployment } = useActions()

  const releaseResults = useFetchReleases()
  const deploymentResults = useFetchDeployments()

  const [triggerDeploy, { error, isLoading }] = useMutation(
    async ({
      release,
      environment,
    }: {
      release: string
      environment: string
    }) => {
      await triggerDeployment({ release, environment })
    }
  )

  const releasesSorted = orderBy(
    releaseResults.data,
    (r) => r.createdAt,
    'desc'
  )

  const releasesByTag = keyBy(releasesSorted, (r) => r.tagName)

  const deployments = deploymentResults.data ?? []

  const deploymentsByTag = groupBy(deployments, (d) => d.refName)

  const environmentsOrder = environmentOrderForSelectedRepo || []

  const environments = uniq(
    environmentsOrder.concat(estimateEnvironmentsOrder(deployments))
  )

  const releasesByEnvironment = environments.reduce<
    Record<string, ReleaseModel[]>
  >((record, environment) => {
    record[environment] = deployments
      .filter((d) => d.environment === environment)
      .map((d) => releasesByTag[d.refName])
      .filter((d) => !!d)
    return record
  }, {})

  const isAfterLatestReleaseForEnvironment = (
    release: ReleaseModel,
    environment: string
  ) => {
    const latestRelease = releasesByEnvironment[environment]?.[0]
    return !latestRelease || release.createdAt.isAfter(latestRelease.createdAt)
  }

  return (
    <>
      {error instanceof Error && (
        <Alert severity="error">{error.message}</Alert>
      )}
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Release name</TableCell>
            {environments.map((environment) => (
              <TableCell key={environment}>{environment}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {releasesSorted.map((release) => (
            <TableRow key={release.id}>
              <TableCell style={{ width: '20%' }}>{release.name}</TableCell>
              {environments.map((environment) => {
                const deployment = deploymentsByTag[release.tagName]?.find(
                  (d) => d.environment === environment
                )
                const isLatest = isAfterLatestReleaseForEnvironment(
                  release,
                  environment
                )
                return (
                  <TableCell key={environment}>
                    {deployment ? (
                      <Button
                        disabled={isLoading}
                        variant="outlined"
                        style={{ color: getButtonColor(deployment.state) }}
                        onClick={() =>
                          triggerDeploy({
                            release: release.tagName,
                            environment,
                          })
                        }>
                        {deployment.state}
                      </Button>
                    ) : (
                      <Button
                        disabled={isLoading}
                        variant={isLatest ? 'contained' : 'outlined'}
                        color={isLatest ? 'primary' : 'default'}
                        onClick={() =>
                          triggerDeploy({
                            release: release.tagName,
                            environment,
                          })
                        }>
                        Deploy
                      </Button>
                    )}
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  )
}
