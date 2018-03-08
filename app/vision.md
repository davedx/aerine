Principles and vision

Inspiration:

* Ruby on Rails CRUD scaffolding and ActiveRecord
* React, Relay and GraphQL declarative views, data fetching, and data flow

* These two things didn't go far enough:
  * Rails still requires opaque wiring
  * Database evolution (migrations) could be easier in development
  * GraphQL is painful and tricky to implement in backend
  * Relay has echoes of Redux, boilerplate
  * Facebook projects tend to be technically powerful but don't always have simplest API's

* Data driven development:
  * View templates are the source of truth for what data is required
  * View templates also define what mutations should be performed
  * Routing tables define top level components and how to navigate between them
  * The database schema defines the data types and their properties and relations
  * Imperative programming is still fully supported through familiar component lifecycle hooks

* Convention over configuration:
  * Building on the prior art established by Rails:
  * All data has created and updated timestamps
  * All systems have user creation and authentication by default
    * This includes standard secure password hashing
    * Also includes a session token for every user
  * All data also has owners: creator and updater
    * This enables a default authorization system
  * Just Use Postgres (tm)
    * (Although try to keep the API so that other storage engines could be used)
  * Just Use REST (tm)
    * Extend REST cleanly
    * Allow API to be easily and simply used by third party clients (e.g. mobile apps or other API's)
  * Just Use JavaScript and JSON (tm)
    * Duh

