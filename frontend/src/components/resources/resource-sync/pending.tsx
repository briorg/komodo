import { Section } from "@components/layouts";
import { MonacoDiffEditor, MonacoEditor } from "@components/monaco";
import { useExecute, useRead } from "@lib/hooks";
import { Card, CardContent, CardHeader } from "@ui/card";
import { ReactNode } from "react";
import { ResourceLink } from "../common";
import { UsableResource } from "@types";
import { diff_type_intention, text_color_class_by_intention } from "@lib/color";
import { cn, sanitizeOnlySpan } from "@lib/utils";
import { ConfirmButton } from "@components/util";
import { SquarePlay } from "lucide-react";
import { usePermissions } from "@lib/hooks";
import { useFullResourceSync, usePendingView } from ".";
import { Tabs, TabsList, TabsTrigger } from "@ui/tabs";
import { ResourceDiff } from "komodo_client/dist/types";

export const ResourceSyncPending = ({
  id,
  titleOther,
}: {
  id: string;
  titleOther: ReactNode;
}) => {
  const syncing = useRead("GetResourceSyncActionState", { sync: id }).data
    ?.syncing;
  const sync = useFullResourceSync(id);
  const { canExecute } = usePermissions({ type: "ResourceSync", id });
  const [_pendingView, setPendingView] = usePendingView();
  const pendingView = sync?.config?.managed ? _pendingView : "Execute";
  const { mutate, isPending } = useExecute("RunSync");
  const loading = isPending || syncing;
  return (
    <Section
      titleOther={titleOther}
    >
      <div className="flex items-center gap-4 py-2 flex-wrap">
        {sync?.config?.managed && (
          <Tabs value={pendingView} onValueChange={setPendingView as any}>
            <TabsList className="justify-start w-fit">
              <TabsTrigger value="Execute" className="w-[110px]">
                Execute
              </TabsTrigger>
              <TabsTrigger value="Commit" className="w-[110px]">
                Commit
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        <div className="text-muted-foreground">{pendingView} Mode:</div>
        <div className="flex items-center gap-1 flex-wrap">
          {pendingView === "Execute" && (
            <>
              Update resources in the
              <div className="font-bold">UI</div>
              to match the
              <div className="font-bold">file changes.</div>
            </>
          )}
          {pendingView === "Commit" && (
            <>
              Update resources in the
              <div className="font-bold">file</div>
              to match the
              <div className="font-bold">UI changes.</div>
            </>
          )}
        </div>
      </div>

      {/* Pending Error */}
      {sync?.info?.pending_error && sync.info.pending_error.length ? (
        <Card>
          <CardHeader
            className={cn(
              "font-mono pb-2",
              text_color_class_by_intention("Critical")
            )}
          >
            Error
          </CardHeader>
          <CardContent>
            <pre
              dangerouslySetInnerHTML={{
                __html: sanitizeOnlySpan(sync.info.pending_error),
              }}
            />
          </CardContent>
        </Card>
      ) : undefined}

      {/* Pending Deploy */}
      {pendingView === "Execute" && sync?.info?.pending_deploy?.to_deploy ? (
        <Card>
          <CardHeader
            className={cn(
              "font-mono pb-2",
              text_color_class_by_intention("Warning")
            )}
          >
            Deploy {sync.info.pending_deploy.to_deploy} Resource
            {sync.info.pending_deploy.to_deploy > 1 ? "s" : ""}
          </CardHeader>
          <CardContent>
            <pre
              dangerouslySetInnerHTML={{
                __html: sanitizeOnlySpan(sync.info.pending_deploy.log),
              }}
            />
          </CardContent>
        </Card>
      ) : undefined}

      {/* Pending Resource Update */}
      {sync?.info?.resource_updates?.map((update) => {
        return (
          <Card key={update.target.type + update.target.id}>
            <CardHeader className="pb-4 flex flex-row justify-between items-center">
              <div className="flex items-center gap-4 font-mono">
                <div
                  className={text_color_class_by_intention(
                    diff_type_intention(
                      update.data.type,
                      pendingView === "Commit"
                    )
                  )}
                >
                  {pendingView === "Commit"
                    ? reverse_pending_type(update.data.type)
                    : update.data.type}{" "}
                  {update.target.type}
                </div>
                <div className="text-muted-foreground">|</div>
                {update.data.type === "Create" ? (
                  <div>{update.data.data.name}</div>
                ) : (
                  <ResourceLink
                    type={update.target.type as UsableResource}
                    id={update.target.id}
                  />
                )}
              </div>
              {canExecute && pendingView === "Execute" && (
                <ConfirmButton
                  title="Execute Change"
                  icon={<SquarePlay className="w-4 h-4" />}
                  onClick={() =>
                    mutate({
                      sync: id,
                      resource_type: update.target.type,
                      resources: [
                        update.data.type === "Create"
                          ? update.data.data.name!
                          : update.target.id,
                      ],
                    })
                  }
                  loading={loading}
                />
              )}
            </CardHeader>
            <CardContent>
              {update.data.type === "Create" && (
                <MonacoEditor
                  value={update.data.data.proposed}
                  language="toml"
                  readOnly
                />
              )}
              {update.data.type === "Update" && (
                <>
                  {pendingView === "Execute" && (
                    <MonacoDiffEditor
                      original={update.data.data.current}
                      modified={update.data.data.proposed}
                      language="toml"
                      readOnly
                    />
                  )}
                  {pendingView === "Commit" && (
                    <MonacoDiffEditor
                      original={update.data.data.proposed}
                      modified={update.data.data.current}
                      language="toml"
                      readOnly
                    />
                  )}
                </>
              )}
              {update.data.type === "Delete" && (
                <MonacoEditor
                  value={update.data.data.current}
                  language="toml"
                  readOnly
                />
              )}
            </CardContent>
          </Card>
        );
      })}
      {/* Pending Variable Update */}
      {sync?.info?.variable_updates?.map((data, i) => {
        return (
          <Card key={i}>
            <CardHeader
              className={cn(
                "font-mono pb-2",
                text_color_class_by_intention(
                  diff_type_intention(data.type, pendingView === "Commit")
                )
              )}
            >
              {pendingView === "Commit"
                ? reverse_pending_type(data.type)
                : data.type}{" "}
              Variable
            </CardHeader>
            <CardContent>
              {data.type === "Create" && (
                <MonacoEditor
                  value={data.data.proposed}
                  language="toml"
                  readOnly
                />
              )}
              {data.type === "Update" && (
                <>
                  {pendingView === "Execute" && (
                    <MonacoDiffEditor
                      original={data.data.current}
                      modified={data.data.proposed}
                      language="toml"
                      readOnly
                    />
                  )}
                  {pendingView === "Commit" && (
                    <MonacoDiffEditor
                      original={data.data.proposed}
                      modified={data.data.current}
                      language="toml"
                      readOnly
                    />
                  )}
                </>
              )}
              {data.type === "Delete" && (
                <MonacoEditor
                  value={data.data.current}
                  language="toml"
                  readOnly
                />
              )}
            </CardContent>
          </Card>
        );
      })}
      {/* Pending User Group Update */}
      {sync?.info?.user_group_updates?.map((data, i) => {
        return (
          <Card key={i}>
            <CardHeader
              className={cn(
                "font-mono pb-2",
                text_color_class_by_intention(
                  diff_type_intention(data.type, pendingView === "Commit")
                )
              )}
            >
              {pendingView === "Commit"
                ? reverse_pending_type(data.type)
                : data.type}{" "}
              User Group
            </CardHeader>
            <CardContent>
              {data.type === "Create" && (
                <MonacoEditor
                  value={data.data.proposed}
                  language="toml"
                  readOnly
                />
              )}
              {data.type === "Update" && (
                <>
                  {pendingView === "Execute" && (
                    <MonacoDiffEditor
                      original={data.data.current}
                      modified={data.data.proposed}
                      language="toml"
                      readOnly
                    />
                  )}
                  {pendingView === "Commit" && (
                    <MonacoDiffEditor
                      original={data.data.proposed}
                      modified={data.data.current}
                      language="toml"
                      readOnly
                    />
                  )}
                </>
              )}
              {data.type === "Delete" && (
                <MonacoEditor
                  value={data.data.current}
                  language="toml"
                  readOnly
                />
              )}
            </CardContent>
          </Card>
        );
      })}
    </Section>
  );
};

const reverse_pending_type = (type: ResourceDiff["data"]["type"]) => {
  switch (type) {
    case "Create":
      return "Remove";
    case "Update":
      return "Update";
    case "Delete":
      return "Add";
  }
};
