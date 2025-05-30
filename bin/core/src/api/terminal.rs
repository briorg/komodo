use anyhow::Context;
use axum::{Extension, Router, middleware, routing::post};
use komodo_client::{
  api::terminal::ExecuteTerminalBody,
  entities::{
    permission::PermissionLevel, server::Server, user::User,
  },
};
use serror::Json;
use uuid::Uuid;

use crate::{
  auth::auth_request, helpers::periphery_client,
  permission::get_check_permissions,
};

pub fn router() -> Router {
  Router::new()
    .route("/execute", post(execute))
    .layer(middleware::from_fn(auth_request))
}

async fn execute(
  Extension(user): Extension<User>,
  Json(request): Json<ExecuteTerminalBody>,
) -> serror::Result<axum::body::Body> {
  execute_inner(Uuid::new_v4(), request, user).await
}

#[instrument(
  name = "ExecuteTerminal",
  skip(user),
  fields(
    user_id = user.id,
  )
)]
async fn execute_inner(
  req_id: Uuid,
  ExecuteTerminalBody {
    server,
    terminal,
    command,
  }: ExecuteTerminalBody,
  user: User,
) -> serror::Result<axum::body::Body> {
  info!("/terminal request | user: {}", user.username);

  let res = async {
    let server = get_check_permissions::<Server>(
      &server,
      &user,
      PermissionLevel::Read.terminal(),
    )
    .await?;

    let periphery = periphery_client(&server)?;

    let stream = periphery
      .execute_terminal(terminal, command)
      .await
      .context("Failed to execute command on periphery")?;

    anyhow::Ok(stream)
  }
  .await;

  let stream = match res {
    Ok(stream) => stream,
    Err(e) => {
      warn!("/terminal request {req_id} error: {e:#}");
      return Err(e.into());
    }
  };

  Ok(axum::body::Body::from_stream(stream.into_line_stream()))
}
